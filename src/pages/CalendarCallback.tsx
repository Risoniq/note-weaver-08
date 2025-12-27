import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

const CalendarCallback = () => {
  const navigate = useNavigate();
  const [message, setMessage] = useState('Verbindung wird hergestellt...');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<Record<string, string | null>>({});

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        
        // Capture all URL parameters for debugging
        const allParams: Record<string, string | null> = {};
        urlParams.forEach((value, key) => {
          allParams[key] = value;
        });
        
        // Also check hash params (some OAuth flows use hash)
        const hashParams = new URLSearchParams(window.location.hash.replace('#', '?'));
        hashParams.forEach((value, key) => {
          allParams[`hash_${key}`] = value;
        });
        
        setDebugInfo(allParams);
        
        console.log('[CalendarCallback] Full URL:', window.location.href);
        console.log('[CalendarCallback] All URL params:', allParams);
        
        const oauthSuccess = urlParams.get('oauth_success');
        const oauthError = urlParams.get('oauth_error');
        const provider = urlParams.get('provider');
        
        // Microsoft-specific error parameters
        const msError = urlParams.get('error');
        const msErrorDescription = urlParams.get('error_description');
        const msErrorUri = urlParams.get('error_uri');
        
        // Recall.ai specific parameters
        const recallError = urlParams.get('recall_error');
        
        console.log('[CalendarCallback] Parsed params:', { 
          oauthSuccess, 
          oauthError, 
          provider, 
          msError,
          msErrorDescription,
          recallError
        });

        // Check stored provider from session (set before redirect)
        const storedProvider = sessionStorage.getItem('recall_oauth_provider');
        const effectiveProvider = provider || storedProvider;

        // Handle Microsoft-specific errors
        if (msError) {
          console.error('[CalendarCallback] Microsoft OAuth error:', msError, msErrorDescription);
          setStatus('error');
          
          let userMessage = 'Microsoft-Anmeldung fehlgeschlagen';
          let details = msErrorDescription || msError;
          
          // Translate common Microsoft errors
          if (msError === 'access_denied') {
            userMessage = 'Zugriff verweigert';
            details = 'Du hast die Berechtigung abgelehnt oder es fehlen Admin-Rechte.';
          } else if (msError === 'consent_required' || msError === 'interaction_required') {
            userMessage = 'Admin-Zustimmung erforderlich';
            details = 'Dein Microsoft-Administrator muss diese App genehmigen.';
          } else if (msError === 'invalid_request') {
            userMessage = 'Ungültige Anfrage';
            details = msErrorDescription || 'Die OAuth-Konfiguration ist fehlerhaft.';
          } else if (msError === 'invalid_client') {
            userMessage = 'Ungültige Client-Konfiguration';
            details = 'Client ID oder Secret sind falsch konfiguriert.';
          }
          
          setMessage(userMessage);
          setErrorDetails(details);
          sessionStorage.removeItem('recall_oauth_provider');
          return;
        }

        // Handle Recall.ai specific errors
        if (recallError) {
          console.error('[CalendarCallback] Recall.ai error:', recallError);
          setStatus('error');
          setMessage('Recall.ai Fehler');
          setErrorDetails(recallError);
          sessionStorage.removeItem('recall_oauth_provider');
          return;
        }

        // Handle general OAuth error cases
        if (oauthError === 'true') {
          console.error('[CalendarCallback] OAuth failed');
          setStatus('error');
          setMessage('Verbindung fehlgeschlagen');
          setErrorDetails('Der OAuth-Flow wurde nicht erfolgreich abgeschlossen.');
          sessionStorage.removeItem('recall_oauth_provider');
          return;
        }

        // If opened as popup, try to communicate with opener
        if (window.opener && !window.opener.closed) {
          const callbackMessage = {
            type: 'google-auth-callback' as const,
            success: oauthSuccess === 'true',
            provider: effectiveProvider,
            error: msError || recallError || undefined,
          };
          window.opener.postMessage(callbackMessage, window.location.origin);
          console.log('[CalendarCallback] Posted message to opener');
          window.close();
          return;
        }

        // Redirect flow: OAuth was successful
        if (oauthSuccess === 'true' || storedProvider) {
          sessionStorage.removeItem('recall_oauth_provider');
          setStatus('success');
          setMessage('Kalender erfolgreich verbunden!');
          
          console.log('[CalendarCallback] OAuth successful, redirecting to home with provider:', effectiveProvider);
          
          // Redirect back to main page with success flag
          setTimeout(() => {
            navigate(`/?oauth_complete=true&provider=${effectiveProvider}`);
          }, 1500);
          return;
        }

        // Fallback: No clear state, show debug info
        console.log('[CalendarCallback] No clear OAuth state, showing debug info');
        setStatus('error');
        setMessage('Unbekannter OAuth-Status');
        setErrorDetails('Keine erkennbaren OAuth-Parameter in der URL gefunden.');
      } catch (err) {
        console.error('[CalendarCallback] Error handling callback', err);
        setStatus('error');
        setMessage('Ein Fehler ist aufgetreten');
        setErrorDetails(err instanceof Error ? err.message : 'Unbekannter Fehler');
        sessionStorage.removeItem('recall_oauth_provider');
      }
    };

    handleCallback();
  }, [navigate]);

  const handleRetry = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full space-y-4">
        {status === 'loading' && (
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-muted-foreground">{message}</p>
          </div>
        )}
        
        {status === 'success' && (
          <Alert className="border-green-500/50 bg-green-500/10">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <AlertTitle className="text-green-500">{message}</AlertTitle>
            <AlertDescription>
              Du wirst in Kürze weitergeleitet...
            </AlertDescription>
          </Alert>
        )}
        
        {status === 'error' && (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{message}</AlertTitle>
              {errorDetails && (
                <AlertDescription className="mt-2">
                  {errorDetails}
                </AlertDescription>
              )}
            </Alert>
            
            <Button onClick={handleRetry} className="w-full">
              Zurück zur Startseite
            </Button>
            
            {/* Debug info for development */}
            {Object.keys(debugInfo).length > 0 && (
              <details className="mt-4 text-xs">
                <summary className="cursor-pointer text-muted-foreground">Debug-Informationen</summary>
                <pre className="mt-2 p-2 bg-muted rounded text-left overflow-auto max-h-40">
                  {JSON.stringify(debugInfo, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CalendarCallback;
