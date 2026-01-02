import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { User } from '@supabase/supabase-js';

export type GoogleCalendarStatus = 'disconnected' | 'connecting' | 'connected' | 'syncing' | 'error';

export function useGoogleRecallCalendar() {
  const [status, setStatus] = useState<GoogleCalendarStatus>('disconnected');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [connected, setConnected] = useState(false);
  const [recallUserId, setRecallUserId] = useState<string | null>(null);
  const [pendingOauthUrl, setPendingOauthUrl] = useState<string | null>(null);

  const retryCountRef = useRef(0);
  const maxRetries = 3;

  // Get authenticated user
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

  // Check status on mount
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
      
      const { data, error: funcError } = await supabase.functions.invoke('google-recall-auth', {
        body: { 
          action: 'status', 
          supabase_user_id: authUser.id,
          user_email: authUser.email,
        },
      });

      if (funcError) throw funcError;

      if (data.success) {
        setConnected(data.connected);
        setRecallUserId(data.recall_user_id || null);
        
        if (data.connected) {
          setStatus('connected');
          retryCountRef.current = 0;
        } else {
          setStatus('disconnected');
        }
      }
    } catch (err: any) {
      console.error('[useGoogleRecallCalendar] Error checking status:', err);
      setError(err.message || 'Fehler beim Prüfen des Status');
      setStatus('error');
    } finally {
      setIsLoading(false);
    }
  }, [authUser?.id, authUser?.email]);

  // Listen for postMessage from OAuth popup
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (!event.origin.includes(window.location.hostname) && !event.origin.includes('lovableproject.com') && !event.origin.includes('lovable.app')) {
        return;
      }
      
      if (event.data?.type === 'recall-oauth-callback' && event.data?.success && event.data?.provider === 'google') {
        console.log('[useGoogleRecallCalendar] Received OAuth success message from popup');
        setStatus('syncing');
        toast.success('Google Kalender wird synchronisiert...');
        
        if (authUser?.id) {
          await checkStatus(true);
        }
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [authUser?.id, checkStatus]);

  // Check for OAuth callback on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const oauthComplete = urlParams.get('oauth_complete');
    const oauthError = urlParams.get('oauth_error');
    const provider = urlParams.get('provider');
    
    if (provider !== 'google') return;

    if (oauthComplete === 'true') {
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
      
      setStatus('syncing');
      toast.success('Google Kalender wird synchronisiert...');
      
      if (authUser?.id) {
        const checkWithRetry = async () => {
          for (let i = 0; i < maxRetries; i++) {
            await new Promise(resolve => setTimeout(resolve, (i + 1) * 2000));
            
            const { data } = await supabase.functions.invoke('google-recall-auth', {
              body: { 
                action: 'status', 
                supabase_user_id: authUser.id,
                user_email: authUser.email,
              },
            });
            
            if (data?.success && data.connected) {
              setConnected(true);
              setRecallUserId(data.recall_user_id || null);
              setStatus('connected');
              toast.success('Google Kalender erfolgreich verbunden!');
              return;
            }
          }
          
          setStatus('disconnected');
          toast.error('Google Kalender-Verbindung konnte nicht bestätigt werden.');
        };
        
        checkWithRetry();
      }
    }
    
    if (oauthError === 'true') {
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
      toast.error('Google Kalender-Verbindung fehlgeschlagen.');
    }
  }, [authUser?.id, authUser?.email]);

  const connect = useCallback(async () => {
    if (!authUser?.id) {
      toast.error('Du musst angemeldet sein, um deinen Kalender zu verbinden.');
      return;
    }

    try {
      setIsLoading(true);
      setStatus('connecting');
      setError(null);
      setPendingOauthUrl(null);

      const redirectUri = `${window.location.origin}/calendar-callback`;

      const { data, error: funcError } = await supabase.functions.invoke('google-recall-auth', {
        body: {
          action: 'authenticate',
          supabase_user_id: authUser.id,
          user_email: authUser.email,
          redirect_uri: redirectUri,
        },
      });

      if (funcError) throw funcError;

      if (data.success && data.oauth_url) {
        sessionStorage.setItem('recall_oauth_provider', 'google');
        setPendingOauthUrl(data.oauth_url);

        const width = 600;
        const height = 700;
        const left = Math.max(0, (window.screen.width - width) / 2);
        const top = Math.max(0, (window.screen.height - height) / 2);
        
        const popup = window.open(
          data.oauth_url,
          'google-recall-auth',
          `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
        );
        
        if (!popup) {
          toast.error('Popup wurde blockiert. Bitte öffne die Anmeldung manuell über den Button.');
          setIsLoading(false);
          return;
        }

        toast.info('Google Login geöffnet. Bitte schließe das Popup nach der Anmeldung.', { duration: 10000 });
        setIsLoading(false);

        // Poll for connection status
        let pollCount = 0;
        const maxPolls = 200;

        const pollForConnection = setInterval(async () => {
          pollCount++;

          try {
            const { data: statusData } = await supabase.functions.invoke('google-recall-auth', {
              body: {
                action: 'status',
                supabase_user_id: authUser.id,
                user_email: authUser.email,
              },
            });

            if (statusData?.success && statusData.connected) {
              clearInterval(pollForConnection);
              setPendingOauthUrl(null);
              setConnected(true);
              setRecallUserId(statusData.recall_user_id || null);
              setStatus('connected');
              toast.success('Google Kalender erfolgreich verbunden!');
              try { popup.close(); } catch {}
            }
          } catch (err) {
            console.error('[useGoogleRecallCalendar] Polling error:', err);
          }

          if (pollCount >= maxPolls) {
            clearInterval(pollForConnection);
            setPendingOauthUrl(null);
            setStatus('disconnected');
            toast.error('Zeitüberschreitung bei der Google Kalender-Verbindung.');
          }
        }, 1500);

        return;
      }
    } catch (err: any) {
      console.error('[useGoogleRecallCalendar] Error connecting:', err);
      setError(err.message || 'Fehler beim Verbinden');
      setStatus('error');
      setIsLoading(false);
    }
  }, [authUser?.id, authUser?.email]);

  const disconnect = useCallback(async () => {
    if (!authUser?.id) return;

    try {
      setIsLoading(true);
      const { data, error: funcError } = await supabase.functions.invoke('google-recall-auth', {
        body: { action: 'disconnect', supabase_user_id: authUser.id },
      });

      if (funcError) throw funcError;

      if (data.success) {
        setConnected(false);
        setStatus('disconnected');
        toast.success('Google Kalender getrennt');
      }
    } catch (err: any) {
      console.error('[useGoogleRecallCalendar] Error disconnecting:', err);
      toast.error('Fehler beim Trennen des Google Kalenders');
    } finally {
      setIsLoading(false);
    }
  }, [authUser?.id]);

  return {
    status,
    isLoading,
    error,
    connected,
    recallUserId,
    pendingOauthUrl,
    connect,
    disconnect,
    checkStatus,
  };
}
