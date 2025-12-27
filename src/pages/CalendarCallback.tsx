import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const CalendarCallback = () => {
  const navigate = useNavigate();
  const [message, setMessage] = useState('Verbindung wird hergestellt...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const oauthSuccess = urlParams.get('oauth_success');
        const oauthError = urlParams.get('oauth_error');
        const provider = urlParams.get('provider');
        const error = urlParams.get('error');

        console.log('[CalendarCallback] Received params', { 
          oauthSuccess, 
          oauthError, 
          provider, 
          error,
          fullUrl: window.location.href 
        });

        // Check stored provider from session (set before redirect)
        const storedProvider = sessionStorage.getItem('recall_oauth_provider');
        const effectiveProvider = provider || storedProvider;

        // Handle error cases
        if (oauthError === 'true' || error) {
          console.error('[CalendarCallback] OAuth failed:', error || 'Unknown error');
          setMessage('Verbindung fehlgeschlagen. Bitte versuche es erneut.');
          sessionStorage.removeItem('recall_oauth_provider');
          setTimeout(() => navigate('/?oauth_error=true'), 2000);
          return;
        }

        // If opened as popup, try to communicate with opener
        if (window.opener && !window.opener.closed) {
          const callbackMessage = {
            type: 'google-auth-callback' as const,
            success: oauthSuccess === 'true',
            provider: effectiveProvider,
            error: error || undefined,
          };
          window.opener.postMessage(callbackMessage, window.location.origin);
          console.log('[CalendarCallback] Posted message to opener');
          window.close();
          return;
        }

        // Redirect flow: OAuth was successful
        if (oauthSuccess === 'true' || storedProvider) {
          sessionStorage.removeItem('recall_oauth_provider');
          setMessage('Kalender erfolgreich verbunden! Lade Termine...');
          
          console.log('[CalendarCallback] OAuth successful, redirecting to home with provider:', effectiveProvider);
          
          // Redirect back to main page with success flag
          setTimeout(() => {
            navigate(`/?oauth_complete=true&provider=${effectiveProvider}`);
          }, 1000);
          return;
        }

        // Fallback: No clear state, just redirect home
        console.log('[CalendarCallback] No clear OAuth state, redirecting home');
        setMessage('Weiterleitung zur Startseite...');
        setTimeout(() => navigate('/'), 1500);
      } catch (err) {
        console.error('[CalendarCallback] Error handling callback', err);
        setMessage('Ein Fehler ist aufgetreten');
        sessionStorage.removeItem('recall_oauth_provider');
        setTimeout(() => navigate('/'), 2000);
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-muted-foreground">{message}</p>
      </div>
    </div>
  );
};

export default CalendarCallback;
