import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { User } from '@supabase/supabase-js';
import { withTokenRefresh } from '@/lib/retryWithTokenRefresh';

export interface RecallMeeting {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  meeting_url: string | null;
  platform: string | null;
  bot_id: string | null;
  will_record: boolean;
  will_record_reason: string | null;
  override_should_record: boolean | null;
  attendees: { email: string; name?: string }[];
  organizer: string | null;
  is_organizer: boolean;
}

export interface RecordingPreferences {
  record_all: boolean;
  record_only_owned: boolean;
  record_external: boolean;
  auto_record: boolean;
}

const AUTO_REFRESH_INTERVAL = 15000; // 15 seconds

// Compare two meetings to check if they have meaningful differences
function meetingHasChanged(oldMeeting: RecallMeeting, newMeeting: RecallMeeting): boolean {
  return (
    oldMeeting.title !== newMeeting.title ||
    oldMeeting.start_time !== newMeeting.start_time ||
    oldMeeting.end_time !== newMeeting.end_time ||
    oldMeeting.meeting_url !== newMeeting.meeting_url ||
    oldMeeting.platform !== newMeeting.platform ||
    oldMeeting.bot_id !== newMeeting.bot_id ||
    oldMeeting.will_record !== newMeeting.will_record ||
    oldMeeting.will_record_reason !== newMeeting.will_record_reason ||
    oldMeeting.override_should_record !== newMeeting.override_should_record ||
    oldMeeting.organizer !== newMeeting.organizer ||
    oldMeeting.is_organizer !== newMeeting.is_organizer ||
    oldMeeting.attendees.length !== newMeeting.attendees.length
  );
}

// Compare meeting lists and return true if there are any differences
function meetingsHaveChanged(oldMeetings: RecallMeeting[], newMeetings: RecallMeeting[]): boolean {
  // Different count = definitely changed
  if (oldMeetings.length !== newMeetings.length) {
    return true;
  }
  
  // Create a map for quick lookup
  const oldMap = new Map(oldMeetings.map(m => [m.id, m]));
  
  // Check if any meeting has changed or if there's a new one
  for (const newMeeting of newMeetings) {
    const oldMeeting = oldMap.get(newMeeting.id);
    if (!oldMeeting || meetingHasChanged(oldMeeting, newMeeting)) {
      return true;
    }
  }
  
  return false;
}

export function useRecallCalendarMeetings() {
  const [isLoading, setIsLoading] = useState(false);
  const [meetingsError, setMeetingsError] = useState<string | null>(null);
  const [meetings, setMeetings] = useState<RecallMeeting[]>([]);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [preferences, setPreferences] = useState<RecordingPreferences>({
    record_all: true,
    record_only_owned: false,
    record_external: true,
    auto_record: true,
  });
  
  const lastFetchRef = useRef<number>(0);
  const pendingFetchRef = useRef<boolean>(false);
  const [isRefreshingCalendar, setIsRefreshingCalendar] = useState(false);

  // Get authenticated user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setAuthUser(user);
    };
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const newUser = session?.user ?? null;
      setAuthUser(newUser);
      
      // Clear meetings when user logs out to prevent stale data/errors
      if (event === 'SIGNED_OUT' || !newUser) {
        setMeetings([]);
        setMeetingsError(null);
        pendingFetchRef.current = false;
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchMeetings = useCallback(async (isAutoRefresh = false) => {
    // If authUser not ready, mark pending and return
    if (!authUser?.id) {
      pendingFetchRef.current = true;
      console.log('[useRecallCalendarMeetings] fetchMeetings called but authUser not ready, marking pending');
      return;
    }

    try {
      // Only show loading state on initial load, not on auto-refresh
      if (!isAutoRefresh) {
        setIsLoading(true);
      }
      setMeetingsError(null);
      console.log('[useRecallCalendarMeetings] Fetching meetings for user:', authUser.id, isAutoRefresh ? '(auto-refresh)' : '');
      const { data, error: funcError } = await withTokenRefresh(
        () => supabase.functions.invoke('recall-calendar-meetings', {
          body: { action: 'list', supabase_user_id: authUser.id },
        }),
        { maxRetries: 1 }
      );

      if (funcError) throw funcError;

      if (data.success) {
        const newMeetings: RecallMeeting[] = data.meetings || [];
        console.log('[useRecallCalendarMeetings] Loaded meetings:', newMeetings.length);
        
        // Only update state if meetings have actually changed
        setMeetings(prevMeetings => {
          if (meetingsHaveChanged(prevMeetings, newMeetings)) {
            console.log('[useRecallCalendarMeetings] Meetings changed, updating state');
            return newMeetings;
          }
          console.log('[useRecallCalendarMeetings] No changes detected, keeping current state');
          return prevMeetings;
        });
        setMeetingsError(null);
      } else {
        const errorMsg = data.error || '';
        let friendlyError = 'Meetings konnten nicht geladen werden.';

        if (errorMsg.includes('not_authenticated') || errorMsg.includes('credentials')) {
          friendlyError = 'Die Kalender-Verbindung muss möglicherweise erneuert werden.';
        } else if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
          friendlyError = 'Verbindung zum Server fehlgeschlagen.';
        }

        setMeetingsError(friendlyError);
      }
    } catch (err: any) {
      console.error('[useRecallCalendarMeetings] Error fetching meetings:', err);
      const errorMsg = err.message || '';
      
      // Handle 401 Unauthorized - user session expired/invalid
      // During auto-refresh, keep existing data and silently skip
      // Only clear data if this is a manual fetch (not auto-refresh)
      // After retry with token refresh failed, check if still 401
      if (errorMsg.includes('401') || errorMsg.includes('Unauthorized')) {
        console.log('[useRecallCalendarMeetings] 401 after retry - session fully expired');
        if (!isAutoRefresh) {
          // Only on manual fetch, clear state to force re-login
          setMeetings([]);
          toast.error('Sitzung abgelaufen - bitte neu anmelden');
        }
        return;
      }
      
      let friendlyError = 'Meetings konnten nicht geladen werden.';

      if (errorMsg.includes('not_authenticated') || errorMsg.includes('credentials')) {
        friendlyError = 'Die Kalender-Verbindung muss möglicherweise erneuert werden.';
      } else if (errorMsg.includes('network') || errorMsg.includes('fetch') || errorMsg.includes('Failed to fetch')) {
        friendlyError = 'Verbindung zum Server fehlgeschlagen.';
      }

      setMeetingsError(friendlyError);
    } finally {
      if (!isAutoRefresh) {
        setIsLoading(false);
      }
    }
  }, [authUser?.id]);

  // Execute pending fetch when authUser becomes available
  useEffect(() => {
    if (authUser?.id && pendingFetchRef.current) {
      console.log('[useRecallCalendarMeetings] authUser now available, executing pending fetch');
      pendingFetchRef.current = false;
      fetchMeetings();
    }
  }, [authUser?.id, fetchMeetings]);

  const updateMeetingRecording = useCallback(async (meetingId: string, shouldRecord: boolean) => {
    if (!authUser?.id) return;

    try {
      const { data, error: funcError } = await withTokenRefresh(
        () => supabase.functions.invoke('recall-calendar-meetings', {
          body: { 
            action: 'update_recording', 
            supabase_user_id: authUser.id, 
            meeting_id: meetingId,
            auto_record: shouldRecord,
          },
        }),
        { maxRetries: 1 }
      );

      if (funcError) throw funcError;

      if (data.success) {
        setMeetings(prev => 
          prev.map(m => 
            m.id === meetingId 
              ? { ...m, override_should_record: shouldRecord, will_record: shouldRecord }
              : m
          )
        );
        toast.success(shouldRecord ? 'Aufnahme aktiviert' : 'Aufnahme deaktiviert');
      }
    } catch (err: any) {
      console.error('[useRecallCalendarMeetings] Error updating meeting:', err);
      toast.error('Fehler beim Aktualisieren des Meetings');
    }
  }, [authUser?.id]);

  const updatePreferences = useCallback(async (newPrefs: Partial<RecordingPreferences>) => {
    if (!authUser?.id) return;

    try {
      const mergedPrefs = { ...preferences, ...newPrefs };
      
      const { data, error: funcError } = await withTokenRefresh(
        () => supabase.functions.invoke('recall-calendar-meetings', {
          body: { 
            action: 'update_preferences', 
            supabase_user_id: authUser.id, 
            preferences: mergedPrefs,
          },
        }),
        { maxRetries: 1 }
      );

      if (funcError) throw funcError;

      if (data.success) {
        setPreferences(mergedPrefs);
        toast.success('Einstellungen gespeichert');
      }
    } catch (err: any) {
      console.error('[useRecallCalendarMeetings] Error updating preferences:', err);
      toast.error('Fehler beim Speichern der Einstellungen');
    }
  }, [authUser?.id, preferences]);

  const initPreferences = useCallback(async () => {
    if (!authUser?.id) return false;

    try {
      const { data, error: funcError } = await withTokenRefresh(
        () => supabase.functions.invoke('recall-calendar-meetings', {
          body: { 
            action: 'init_preferences', 
            supabase_user_id: authUser.id,
          },
        }),
        { maxRetries: 1 }
      );

      if (funcError) throw funcError;

      if (data.success) {
        setPreferences(data.preferences);
        toast.success('Aufnahme-Einstellungen aktiviert');
        return true;
      } else {
        toast.error(data.message || 'Fehler beim Aktivieren');
        return false;
      }
    } catch (err: any) {
      console.error('[useRecallCalendarMeetings] Error initializing preferences:', err);
      toast.error('Fehler beim Aktivieren der Aufnahme-Einstellungen');
      return false;
    }
  }, [authUser?.id]);

  // Refresh calendar from provider (Google/Microsoft) to pick up new meeting links
  const refreshCalendar = useCallback(async (silent = false) => {
    if (!authUser?.id) return false;

    try {
      if (!silent) {
        setIsRefreshingCalendar(true);
      }
      console.log('[useRecallCalendarMeetings] Triggering calendar refresh...');
      
      const { data, error: funcError } = await withTokenRefresh(
        () => supabase.functions.invoke('recall-calendar-meetings', {
          body: { action: 'refresh', supabase_user_id: authUser.id },
        }),
        { maxRetries: 1 }
      );

      if (funcError) throw funcError;

      if (data.success) {
        if (!silent) {
          toast.success('Kalender wird synchronisiert...');
        }
        // Wait a moment, then reload meetings
        setTimeout(() => fetchMeetings(true), 2000);
        return true;
      }
      return false;
    } catch (err: any) {
      console.error('[useRecallCalendarMeetings] Refresh error:', err);
      if (!silent) {
        toast.error('Kalender-Synchronisation fehlgeschlagen');
      }
      return false;
    } finally {
      if (!silent) {
        setIsRefreshingCalendar(false);
      }
    }
  }, [authUser?.id, fetchMeetings]);

  // Auto-refresh meetings AND calendar every 15 seconds when enabled
  useEffect(() => {
    if (!authUser?.id || !autoRefreshEnabled) return;

    console.log('[useRecallCalendarMeetings] Setting up auto-refresh interval (15s) with calendar sync');
    
    const intervalId = setInterval(async () => {
      const now = Date.now();
      // Prevent fetching more often than every 10 seconds (debounce)
      if (now - lastFetchRef.current < 10000) {
        return;
      }
      
      console.log('[useRecallCalendarMeetings] Auto-refresh triggered (meetings + calendar)');
      lastFetchRef.current = now;
      
      // Refresh calendar first (silent), then fetch meetings
      await refreshCalendar(true);
    }, AUTO_REFRESH_INTERVAL);

    return () => {
      console.log('[useRecallCalendarMeetings] Cleaning up auto-refresh interval');
      clearInterval(intervalId);
    };
  }, [authUser?.id, autoRefreshEnabled, refreshCalendar]);

  return {
    isLoading,
    meetingsError,
    meetings,
    preferences,
    autoRefreshEnabled,
    setAutoRefreshEnabled,
    isRefreshingCalendar,
    fetchMeetings,
    updateMeetingRecording,
    updatePreferences,
    initPreferences,
    refreshCalendar,
  };
}
