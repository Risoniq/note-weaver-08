import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, RefreshCw, XCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface ErrorDetails {
  code: string;
  message: string;
  suggestion: string;
}

const CalendarCallback = () => {
  const navigate = useNavigate();
  const [message, setMessage] = useState('Verbindung wird hergestellt...');
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'blocked'>('loading');
  const [errorDetails, setErrorDetails] = useState<ErrorDetails | null>(null);
  const [debugInfo, setDebugInfo] = useState<Record<string, string | null>>({});

  // Helper to translate Microsoft OAuth errors to user-friendly messages
  const translateMsError = (error: string, description: string | null): ErrorDetails => {
    // Recall/Microsoft sometimes returns a human-readable string in `error` (not an OAuth error code)
    if (error.toLowerCase().includes('refresh_token missing')) {
      return {
        code: 'refresh_token_missing',
        message: 'Microsoft-Kalender konnte nicht verbunden werden',
        suggestion:
          'Microsoft hat kein Refresh-Token ausgestellt. Bitte versuche die Anmeldung erneut und bestätige die Berechtigungen (Consent). Falls du in einer Organisation bist, kann Admin-Zustimmung nötig sein.',
      };
    }

    switch (error) {
      case 'access_denied':
        return {
          code: 'access_denied',
          message: 'Zugriff verweigert',
          suggestion: 'Du hast die Berechtigung abgelehnt. Bitte versuche es erneut und akzeptiere die Berechtigungsanfrage.',
        };
      case 'consent_required':
        return {
          code: 'consent_required',
          message: 'Admin-Zustimmung erforderlich',
          suggestion: 'Dein Microsoft-Administrator muss diese App genehmigen, bevor du sie nutzen kannst. Bitte kontaktiere deinen IT-Administrator.',
        };
      case 'interaction_required':
        return {
          code: 'interaction_required',
          message: 'Zusätzliche Authentifizierung erforderlich',
          suggestion: 'Microsoft erfordert eine zusätzliche Bestätigung. Bitte versuche es erneut.',
        };
      case 'invalid_request':
        return {
          code: 'invalid_request',
          message: 'Ungültige Anfrage',
          suggestion: description || 'Die OAuth-Anfrage war fehlerhaft. Bitte versuche es erneut.',
        };
      case 'invalid_client':
        return {
          code: 'invalid_client',
          message: 'Konfigurationsfehler',
          suggestion: 'Die Microsoft OAuth-Konfiguration ist fehlerhaft. Bitte kontaktiere den Support.',
        };
      case 'temporarily_unavailable':
        return {
          code: 'temporarily_unavailable',
          message: 'Microsoft-Dienst nicht verfügbar',
          suggestion: 'Der Microsoft-Anmeldedienst ist vorübergehend nicht verfügbar. Bitte versuche es später erneut.',
        };
      default:
        return {
          code: error,
          message: 'Anmeldefehler',
          suggestion: description || 'Ein unbekannter Fehler ist aufgetreten. Bitte versuche es erneut.',
        };
    }
  };

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
        const effectiveProvider = provider || storedProvider || 'unknown';

        // Helper function to handle success - navigate back to app
        const handleSuccess = () => {
          // If opened as popup, try to notify opener and close
          if (window.opener && !window.opener.closed) {
            try {
              window.opener.postMessage({
                type: 'recall-oauth-callback',
                success: true,
                provider: effectiveProvider,
              }, '*');
              console.log('[CalendarCallback] Posted success message to opener');
            } catch (e) {
              console.error('[CalendarCallback] Failed to post message:', e);
            }
            
            // Try to close the popup
            try {
              window.close();
            } catch {
              // If can't close, navigate
            }
          }
          
          // Navigate back to main page (for new tab flow)
          setTimeout(() => {
            navigate(`/?oauth_complete=true&provider=${effectiveProvider}`);
          }, 1500);
        };

        // Handle Microsoft-specific errors
        if (msError) {
          console.error('[CalendarCallback] Microsoft OAuth error:', msError, msErrorDescription);
          setStatus('error');
          
          const errorInfo = translateMsError(msError, msErrorDescription);
          setMessage(errorInfo.message);
          setErrorDetails(errorInfo);
          sessionStorage.removeItem('recall_oauth_provider');
          return;
        }

        // Handle Recall.ai specific errors
        if (recallError) {
          console.error('[CalendarCallback] Recall.ai error:', recallError);
          setStatus('error');
          setMessage('Kalender-Dienst Fehler');
          setErrorDetails({
            code: 'recall_error',
            message: 'Fehler beim Kalender-Dienst',
            suggestion: recallError,
          });
          sessionStorage.removeItem('recall_oauth_provider');
          return;
        }

        // Handle general OAuth error cases
        if (oauthError === 'true') {
          console.error('[CalendarCallback] OAuth failed');
          setStatus('error');
          setMessage('Verbindung fehlgeschlagen');
          setErrorDetails({
            code: 'oauth_failed',
            message: 'OAuth fehlgeschlagen',
            suggestion: 'Der Anmeldevorgang wurde nicht erfolgreich abgeschlossen. Bitte versuche es erneut.',
          });
          sessionStorage.removeItem('recall_oauth_provider');
          return;
        }

        // OAuth success - either explicit or implied by stored provider
        if (oauthSuccess === 'true' || storedProvider) {
          sessionStorage.removeItem('recall_oauth_provider');
          setStatus('success');
          setMessage('Kalender erfolgreich verbunden!');
          
          console.log('[CalendarCallback] OAuth successful, navigating back');
          
          // Navigate back to app
          handleSuccess();
          return;
        }

        // No error but also no success - this might be a direct callback from Recall.ai
        // In this case, we assume success if there's no error
        if (storedProvider || effectiveProvider !== 'unknown') {
          sessionStorage.removeItem('recall_oauth_provider');
          setStatus('success');
          setMessage('Kalender wird synchronisiert...');
          
          console.log('[CalendarCallback] Assuming success, navigating back');
          handleSuccess();
          return;
        }

        // Fallback: No clear state - this could be ERR_BLOCKED_BY_RESPONSE redirect
        // Show special "blocked" state with instructions
        console.log('[CalendarCallback] No clear OAuth state - might be blocked redirect');
        setStatus('blocked');
        setMessage('Anmeldung möglicherweise erfolgreich');
      } catch (err) {
        console.error('[CalendarCallback] Error handling callback', err);
        setStatus('error');
        setMessage('Ein Fehler ist aufgetreten');
        setErrorDetails({
          code: 'exception',
          message: 'Unerwarteter Fehler',
          suggestion: err instanceof Error ? err.message : 'Unbekannter Fehler',
        });
        sessionStorage.removeItem('recall_oauth_provider');
      }
    };

    handleCallback();
  }, [navigate]);

  const handleRetry = () => {
    navigate('/');
  };

  const handleManualClose = () => {
    // Get stored provider for more accurate message
    const storedProvider = sessionStorage.getItem('recall_oauth_provider') || 'google';
    sessionStorage.removeItem('recall_oauth_provider');
    
    // Notify opener that user is done
    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage({
          type: 'recall-oauth-callback',
          success: true,
          provider: storedProvider,
          manual: true,
        }, '*');
      } catch {
        // ignore
      }
    }
    
    // Try to close
    try {
      window.close();
    } catch {
      // If can't close, redirect
      navigate('/');
    }
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
            <AlertDescription className="flex items-center gap-2">
              <RefreshCw className="h-3 w-3 animate-spin" />
              Du wirst in Kürze weitergeleitet...
            </AlertDescription>
          </Alert>
        )}

        {status === 'blocked' && (
          <div className="space-y-4">
            <Alert className="border-yellow-500/50 bg-yellow-500/10">
              <CheckCircle2 className="h-4 w-4 text-yellow-500" />
              <AlertTitle className="text-yellow-600 dark:text-yellow-400">{message}</AlertTitle>
              <AlertDescription className="mt-2 space-y-3">
                <p className="text-sm">
                  Die Anmeldung wurde möglicherweise erfolgreich abgeschlossen. 
                  Aufgrund von Browser-Sicherheitsrichtlinien konnte die Weiterleitung nicht automatisch erfolgen.
                </p>
                <p className="text-sm font-medium">
                  Bitte schließe dieses Fenster manuell. Die Verbindung wird im Hintergrund erkannt.
                </p>
              </AlertDescription>
            </Alert>
            
            <Button onClick={handleManualClose} className="w-full">
              <XCircle className="h-4 w-4 mr-2" />
              Fenster schließen
            </Button>
            
            <p className="text-xs text-center text-muted-foreground">
              Die App prüft automatisch im Hintergrund, ob die Verbindung erfolgreich war.
            </p>
          </div>
        )}
        
        {status === 'error' && (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{message}</AlertTitle>
              {errorDetails && (
                <AlertDescription className="mt-2 space-y-2">
                  <p>{errorDetails.suggestion}</p>
                  {errorDetails.code === 'consent_required' && (
                    <p className="text-xs opacity-75">
                      Fehlercode: {errorDetails.code}
                    </p>
                  )}
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
