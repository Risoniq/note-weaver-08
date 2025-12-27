import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const CalendarCallback = () => {
  const navigate = useNavigate();
  const [message, setMessage] = useState('Verbindung wird hergestellt...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const error = urlParams.get('error');
        const state = urlParams.get('state');

        console.log('[CalendarCallback] Received params', { hasCode: !!code, error, state });

        // Check if this is from a redirect flow (sessionStorage will have the provider)
        const storedProvider = sessionStorage.getItem('recall_oauth_provider');
        
        if (error) {
          setMessage('Verbindung fehlgeschlagen: ' + error);
          setTimeout(() => navigate('/?oauth_error=true'), 2000);
          return;
        }

        // If opened as popup, try to communicate with opener
        if (window.opener && !window.opener.closed) {
          const callbackMessage = {
            type: 'google-auth-callback' as const,
            code,
            error: error || undefined,
          };
          window.opener.postMessage(callbackMessage, window.location.origin);
          console.log('[CalendarCallback] Posted message to opener');
          window.close();
          return;
        }

        // Redirect flow: Navigate back to main page with success indicator
        // The Recall.ai OAuth flow handles the token exchange on their end,
        // so we just need to tell the app to check status
        if (storedProvider) {
          sessionStorage.removeItem('recall_oauth_provider');
          setMessage('Erfolgreich verbunden! Weiterleitung...');
          
          // Redirect back to main page with success flag
          setTimeout(() => {
            navigate(`/?oauth_complete=true&provider=${storedProvider}`);
          }, 1000);
        } else {
          // No opener and no stored provider - just redirect home
          setMessage('Weiterleitung zur Startseite...');
          setTimeout(() => navigate('/'), 1500);
        }
      } catch (err) {
        console.error('[CalendarCallback] Error handling callback', err);
        setMessage('Ein Fehler ist aufgetreten');
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
