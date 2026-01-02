import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { User } from '@supabase/supabase-js';

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

export type CalendarStatus = 'disconnected' | 'connecting' | 'connected' | 'syncing' | 'error';

export function useRecallCalendar() {
  const [status, setStatus] = useState<CalendarStatus>('disconnected');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meetingsError, setMeetingsError] = useState<string | null>(null);
  const [meetings, setMeetings] = useState<RecallMeeting[]>([]);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [microsoftConnected, setMicrosoftConnected] = useState(false);
  const [needsRepair, setNeedsRepair] = useState(false);
  const [recallUserId, setRecallUserId] = useState<string | null>(null);
  const [pendingOauthUrl, setPendingOauthUrl] = useState<string | null>(null);
  const [pendingOauthProvider, setPendingOauthProvider] = useState<'google' | 'microsoft' | null>(null);
  const [preferences, setPreferences] = useState<RecordingPreferences>({
    record_all: true,
    record_only_owned: false,
    record_external: true,
    auto_record: true,
  });

  const retryCountRef = useRef(0);
  const maxRetries = 3;

  // Get authenticated user from Supabase
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setAuthUser(user);
    };
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setAuthUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Check connection status when authenticated user is available
  useEffect(() => {
    if (authUser?.id) {
      checkStatus();
    }
  }, [authUser?.id]);

  const checkStatus = useCallback(async (isRetry = false) => {
    if (!authUser?.id) return;

    try {
      setIsLoading(true);
      if (!isRetry) {
        setError(null);
      }
      
      const { data, error: funcError } = await supabase.functions.invoke('recall-calendar-auth', {
        body: { 
          action: 'status', 
          supabase_user_id: authUser.id,
          user_email: authUser.email,
        },
      });

      if (funcError) throw funcError;

      if (data.success) {
        setGoogleConnected(data.google_connected);
        setMicrosoftConnected(data.microsoft_connected);
        setNeedsRepair(data.needs_repair || false);
        setRecallUserId(data.recall_user_id || null);
        
        if (data.google_connected || data.microsoft_connected) {
          setStatus('connected');
          retryCountRef.current = 0;
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
  }, [authUser?.id, authUser?.email]);

  // Listen for postMessage from OAuth popup
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Verify origin for security
      if (!event.origin.includes(window.location.hostname) && !event.origin.includes('lovableproject.com') && !event.origin.includes('lovable.app')) {
        return;
      }
      
      if (event.data?.type === 'recall-oauth-callback' && event.data?.success) {
        console.log('[useRecallCalendar] Received OAuth success message from popup');
        setStatus('syncing');
        toast.success('Kalender wird synchronisiert...');
        
        // The polling mechanism in connect() will handle detecting the connection
        // but we can also trigger a manual check
        if (authUser?.id) {
          await checkStatus(true);
        }
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [authUser?.id, checkStatus]);

  // Check for OAuth callback on mount (for redirect flow)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const oauthComplete = urlParams.get('oauth_complete');
    const oauthError = urlParams.get('oauth_error');
    const provider = urlParams.get('provider');
    
    if (oauthComplete === 'true') {
      // Clean up URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
      
      // Show syncing message
      setStatus('syncing');
      toast.success(`${provider === 'microsoft' ? 'Microsoft' : 'Google'} Kalender wird synchronisiert...`);
      
      console.log('[useRecallCalendar] OAuth complete, starting status check with retries for user:', authUser?.id);
      
      if (authUser?.id) {
        // Start retry loop to catch Recall.ai processing delay
        const checkWithRetry = async () => {
          for (let i = 0; i < maxRetries; i++) {
            console.log(`[useRecallCalendar] Status check attempt ${i + 1}/${maxRetries}`);
            
            // Wait longer on each retry (2s, 4s, 6s)
            await new Promise(resolve => setTimeout(resolve, (i + 1) * 2000));
            
            const { data } = await supabase.functions.invoke('recall-calendar-auth', {
              body: { 
                action: 'status', 
                supabase_user_id: authUser.id,
                user_email: authUser.email,
              },
            });
            
            if (data?.success) {
              setGoogleConnected(data.google_connected);
              setMicrosoftConnected(data.microsoft_connected);
              setNeedsRepair(data.needs_repair || false);
              setRecallUserId(data.recall_user_id || null);
              
              if (data.google_connected || data.microsoft_connected) {
                setStatus('connected');
                toast.success('Kalender erfolgreich verbunden!');
                await fetchMeetings();
                return;
              }
            }
          }
          
          // After all retries, show sync status
          setStatus('disconnected');
          toast.error('Kalender-Verbindung konnte nicht bestätigt werden. Bitte versuche es erneut.');
        };
        
        checkWithRetry();
      }
    }
    
    if (oauthError === 'true') {
      // Clean up URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
      
      toast.error('Kalender-Verbindung fehlgeschlagen. Bitte versuche es erneut.');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.id, authUser?.email]);


  const fetchMeetings = useCallback(async () => {
    if (!authUser?.id) return;

    try {
      setIsLoading(true);
      setMeetingsError(null);
      const { data, error: funcError } = await supabase.functions.invoke('recall-calendar-meetings', {
        body: { action: 'list', supabase_user_id: authUser.id },
      });

      if (funcError) throw funcError;

      if (data.success) {
        setMeetings(data.meetings || []);
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
      console.error('Error fetching meetings:', err);
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
  }, [authUser?.id]);

  const connect = useCallback(async (provider: 'google' | 'microsoft' = 'google') => {
    if (!authUser?.id) {
      toast.error('Du musst angemeldet sein, um deinen Kalender zu verbinden.');
      return;
    }

    try {
      setIsLoading(true);
      setStatus('connecting');
      setError(null);
      setPendingOauthUrl(null);
      setPendingOauthProvider(null);

      // Build redirect URI for callback
      const redirectUri = `${window.location.origin}/calendar-callback`;

      const { data, error: funcError } = await supabase.functions.invoke('recall-calendar-auth', {
        body: {
          action: 'authenticate',
          supabase_user_id: authUser.id,
          user_email: authUser.email,
          provider,
          redirect_uri: redirectUri,
        },
      });

      if (funcError) throw funcError;

      if (data.success && data.oauth_url) {
        sessionStorage.setItem('recall_oauth_provider', provider);
        
        // Store URL for fallback
        setPendingOauthUrl(data.oauth_url);
        setPendingOauthProvider(provider);

        // Open in NEW TAB instead of popup to avoid ERR_BLOCKED_BY_RESPONSE
        const authTab = window.open(data.oauth_url, '_blank');
        
        if (!authTab) {
          toast.error('Tab wurde blockiert. Bitte öffne die Anmeldung manuell über den Button.');
          setIsLoading(false);
          return;
        }

        toast.info(
          `${provider === 'microsoft' ? 'Microsoft' : 'Google'} Login in neuem Tab geöffnet. Nach der Anmeldung wirst du automatisch zurückgeleitet.`,
          { duration: 15000 }
        );

        setIsLoading(false);

        // Poll for connection + listen for window focus (when user returns)
        let pollCount = 0;
        const maxPolls = 200; // 5 minutes at 1.5s

        const pollForConnection = setInterval(async () => {
          pollCount++;

          try {
            const { data: statusData } = await supabase.functions.invoke('recall-calendar-auth', {
              body: {
                action: 'status',
                supabase_user_id: authUser.id,
                user_email: authUser.email,
              },
            });

            if (statusData?.success) {
              setGoogleConnected(statusData.google_connected);
              setMicrosoftConnected(statusData.microsoft_connected);
              setNeedsRepair(statusData.needs_repair || false);
              setRecallUserId(statusData.recall_user_id || null);

              const connectedNow = Boolean(statusData.google_connected || statusData.microsoft_connected);
              if (connectedNow) {
                clearInterval(pollForConnection);
                setPendingOauthUrl(null);
                setPendingOauthProvider(null);
                setStatus('connected');
                toast.success('Kalender erfolgreich verbunden!');
                await fetchMeetings();
              }
            }
          } catch (err) {
            console.error('Polling error:', err);
          }

          if (pollCount >= maxPolls) {
            clearInterval(pollForConnection);
            setPendingOauthUrl(null);
            setPendingOauthProvider(null);
            setStatus('disconnected');
            toast.error('Zeitüberschreitung bei der Kalender-Verbindung. Bitte versuche es erneut.');
          }
        }, 1500);

        return;
      }
    } catch (err: any) {
      console.error('Error connecting:', err);
      setError(err.message || 'Fehler beim Verbinden');
      setStatus('error');
      setIsLoading(false);
    }
  }, [authUser?.id, authUser?.email, fetchMeetings]);

  const repairConnection = useCallback(async (targetRecallUserId: string) => {
    if (!authUser?.id) return false;

    try {
      setIsLoading(true);
      const { data, error: funcError } = await supabase.functions.invoke('recall-calendar-auth', {
        body: { 
          action: 'repair', 
          supabase_user_id: authUser.id,
          target_recall_user_id: targetRecallUserId,
        },
      });

      if (funcError) throw funcError;

      if (data.success) {
        setGoogleConnected(data.google_connected);
        setMicrosoftConnected(data.microsoft_connected);
        setRecallUserId(data.recall_user_id);
        setNeedsRepair(false);
        setStatus('connected');
        
        toast.success('Verbindung erfolgreich repariert!');
        await fetchMeetings();
        return true;
      } else {
        toast.error(data.error || 'Reparatur fehlgeschlagen');
        return false;
      }
    } catch (err: any) {
      console.error('Error repairing connection:', err);
      toast.error('Fehler beim Reparieren der Verbindung');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [authUser?.id]);

  const disconnectProvider = useCallback(async (provider: 'google' | 'microsoft') => {
    if (!authUser?.id) return;

    try {
      setIsLoading(true);
      const { data, error: funcError } = await supabase.functions.invoke('recall-calendar-auth', {
        body: { action: 'disconnect_provider', supabase_user_id: authUser.id, provider },
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
  }, [authUser?.id]);

  const disconnectGoogle = useCallback(() => disconnectProvider('google'), [disconnectProvider]);
  const disconnectMicrosoft = useCallback(() => disconnectProvider('microsoft'), [disconnectProvider]);



  const updateMeetingRecording = useCallback(async (meetingId: string, shouldRecord: boolean) => {
    if (!authUser?.id) return;

    try {
      const { data, error: funcError } = await supabase.functions.invoke('recall-calendar-meetings', {
        body: { 
          action: 'update_recording', 
          supabase_user_id: authUser.id, 
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
  }, [authUser?.id]);

  const updatePreferences = useCallback(async (newPrefs: Partial<RecordingPreferences>) => {
    if (!authUser?.id) return;

    try {
      const { data, error: funcError } = await supabase.functions.invoke('recall-calendar-meetings', {
        body: { 
          action: 'update_preferences', 
          supabase_user_id: authUser.id, 
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
  }, [authUser?.id]);

  return {
    status,
    isLoading,
    error,
    meetingsError,
    meetings,
    googleConnected,
    microsoftConnected,
    preferences,
    needsRepair,
    recallUserId,
    pendingOauthUrl,
    pendingOauthProvider,
    connect,
    disconnectGoogle,
    disconnectMicrosoft,
    checkStatus,
    fetchMeetings,
    updateMeetingRecording,
    updatePreferences,
    repairConnection,
  };

  return {
    status,
    isLoading,
    error,
    meetingsError,
    meetings,
    userId: authUser?.id || null,
    userEmail: authUser?.email || null,
    googleConnected,
    microsoftConnected,
    preferences,
    needsRepair,
    recallUserId,
    connect,
    disconnectGoogle,
    disconnectMicrosoft,
    checkStatus,
    fetchMeetings,
    updateMeetingRecording,
    updatePreferences,
    repairConnection,
  };
}
