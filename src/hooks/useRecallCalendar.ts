import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface RecallMeeting {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  meeting_url: string | null;
  platform: string | null;
  bot_id: string | null;
  will_record: boolean;
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

export type CalendarStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

const RECALL_USER_ID_KEY = 'recall_calendar_user_id';

export function useRecallCalendar() {
  const [status, setStatus] = useState<CalendarStatus>('disconnected');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meetingsError, setMeetingsError] = useState<string | null>(null);
  const [meetings, setMeetings] = useState<RecallMeeting[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [microsoftConnected, setMicrosoftConnected] = useState(false);
  const [preferences, setPreferences] = useState<RecordingPreferences>({
    record_all: true,
    record_only_owned: false,
    record_external: true,
    auto_record: true,
  });

  // Load user ID from localStorage
  useEffect(() => {
    const storedUserId = localStorage.getItem(RECALL_USER_ID_KEY);
    if (storedUserId) {
      setUserId(storedUserId);
    }
  }, []);

  // Check connection status when user ID is available
  useEffect(() => {
    if (userId) {
      checkStatus();
    }
  }, [userId]);

  const checkStatus = useCallback(async () => {
    if (!userId) return;

    try {
      setIsLoading(true);
      const { data, error: funcError } = await supabase.functions.invoke('recall-calendar-auth', {
        body: { action: 'status', user_id: userId },
      });

      if (funcError) throw funcError;

      if (data.success) {
        setGoogleConnected(data.google_connected);
        setMicrosoftConnected(data.microsoft_connected);
        
        if (data.google_connected || data.microsoft_connected) {
          setStatus('connected');
          // Fetch meetings when connected
          await fetchMeetings();
        } else {
          setStatus('disconnected');
        }
      }
    } catch (err: any) {
      console.error('Error checking status:', err);
      setError(err.message || 'Fehler beim Prüfen des Status');
      setStatus('error');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const connect = useCallback(async (provider: 'google' | 'microsoft' = 'google') => {
    try {
      setIsLoading(true);
      setStatus('connecting');
      setError(null);

      const { data, error: funcError } = await supabase.functions.invoke('recall-calendar-auth', {
        body: { action: 'authenticate', user_id: userId, provider },
      });

      if (funcError) throw funcError;

      if (data.success && data.oauth_url) {
        // Store the user ID
        localStorage.setItem(RECALL_USER_ID_KEY, data.user_id);
        setUserId(data.user_id);

        // Open OAuth popup (same for both providers)
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;

        const popup = window.open(
          data.oauth_url,
          `recall-calendar-oauth-${provider}`,
          `width=${width},height=${height},left=${left},top=${top},popup=1`
        );

        if (!popup) {
          toast.error('Popup wurde blockiert – bitte Popups erlauben und erneut versuchen.');
          setStatus(googleConnected || microsoftConnected ? 'connected' : 'disconnected');
          setIsLoading(false);
          return;
        }

        // Poll for popup close
        const pollTimer = setInterval(async () => {
          if (popup?.closed) {
            clearInterval(pollTimer);
            // Check status after popup closes
            await checkStatus();
          }
        }, 500);

        // Timeout after 5 minutes
        setTimeout(() => {
          clearInterval(pollTimer);
          if (!popup?.closed) {
            popup?.close();
          }
          setStatus(googleConnected || microsoftConnected ? 'connected' : 'disconnected');
          setIsLoading(false);
        }, 300000);
      }
    } catch (err: any) {
      console.error('Error connecting:', err);
      setError(err.message || 'Fehler beim Verbinden');
      setStatus('error');
      setIsLoading(false);
    }
  }, [userId, checkStatus]);

  const disconnectProvider = useCallback(async (provider: 'google' | 'microsoft') => {
    if (!userId) return;

    try {
      setIsLoading(true);
      const { data, error: funcError } = await supabase.functions.invoke('recall-calendar-auth', {
        body: { action: 'disconnect_provider', user_id: userId, provider },
      });

      if (funcError) throw funcError;

      if (data.success) {
        if (provider === 'google') {
          setGoogleConnected(false);
        } else {
          setMicrosoftConnected(false);
        }
        
        // Check if still connected to any provider
        if (!data.still_connected) {
          localStorage.removeItem(RECALL_USER_ID_KEY);
          setUserId(null);
          setStatus('disconnected');
          setMeetings([]);
        }
        
        toast.success(`${provider === 'google' ? 'Google' : 'Microsoft'} Kalender getrennt`);
      }
    } catch (err: any) {
      console.error('Error disconnecting provider:', err);
      toast.error(`Fehler beim Trennen des ${provider === 'google' ? 'Google' : 'Microsoft'} Kalenders`);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const disconnectGoogle = useCallback(() => disconnectProvider('google'), [disconnectProvider]);
  const disconnectMicrosoft = useCallback(() => disconnectProvider('microsoft'), [disconnectProvider]);

  const fetchMeetings = useCallback(async () => {
    if (!userId) return;

    try {
      setIsLoading(true);
      setMeetingsError(null);
      const { data, error: funcError } = await supabase.functions.invoke('recall-calendar-meetings', {
        body: { action: 'list', user_id: userId },
      });

      if (funcError) throw funcError;

      if (data.success) {
        setMeetings(data.meetings || []);
        setMeetingsError(null);
      } else {
        // Translate error to user-friendly message
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
      console.error('Error fetching meetings:', err);
      // Translate error to user-friendly message
      const errorMsg = err.message || '';
      let friendlyError = 'Meetings konnten nicht geladen werden.';
      
      if (errorMsg.includes('not_authenticated') || errorMsg.includes('credentials')) {
        friendlyError = 'Die Kalender-Verbindung muss möglicherweise erneuert werden.';
      } else if (errorMsg.includes('network') || errorMsg.includes('fetch') || errorMsg.includes('Failed to fetch')) {
        friendlyError = 'Verbindung zum Server fehlgeschlagen.';
      }
      
      setMeetingsError(friendlyError);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const updateMeetingRecording = useCallback(async (meetingId: string, shouldRecord: boolean) => {
    if (!userId) return;

    try {
      const { data, error: funcError } = await supabase.functions.invoke('recall-calendar-meetings', {
        body: { 
          action: 'update_recording', 
          user_id: userId, 
          meeting_id: meetingId,
          auto_record: shouldRecord,
        },
      });

      if (funcError) throw funcError;

      if (data.success) {
        // Update local state
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
      console.error('Error updating meeting:', err);
      toast.error('Fehler beim Aktualisieren des Meetings');
    }
  }, [userId]);

  const updatePreferences = useCallback(async (newPrefs: Partial<RecordingPreferences>) => {
    if (!userId) return;

    try {
      const { data, error: funcError } = await supabase.functions.invoke('recall-calendar-meetings', {
        body: { 
          action: 'update_preferences', 
          user_id: userId, 
          auto_record: newPrefs,
        },
      });

      if (funcError) throw funcError;

      if (data.success) {
        setPreferences(data.preferences);
        toast.success('Einstellungen gespeichert');
      }
    } catch (err: any) {
      console.error('Error updating preferences:', err);
      toast.error('Fehler beim Speichern der Einstellungen');
    }
  }, [userId]);

  return {
    status,
    isLoading,
    error,
    meetingsError,
    meetings,
    userId,
    googleConnected,
    microsoftConnected,
    preferences,
    connect,
    disconnectGoogle,
    disconnectMicrosoft,
    checkStatus,
    fetchMeetings,
    updateMeetingRecording,
    updatePreferences,
  };
}
