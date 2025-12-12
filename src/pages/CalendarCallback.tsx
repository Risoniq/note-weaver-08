import { useEffect } from 'react';

const CalendarCallback = () => {
  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const error = urlParams.get('error');

      console.log('[CalendarCallback] Received params', { hasCode: !!code, error });

      const message = {
        type: 'google-auth-callback' as const,
        code,
        error: error || undefined,
      };

      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(message, window.location.origin);
        console.log('[CalendarCallback] Posted message to opener');
        window.close();
      } else {
        console.error('[CalendarCallback] No opener window found');
      }
    } catch (err) {
      console.error('[CalendarCallback] Error handling callback', err);
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Verbindung wird hergestellt...</p>
      </div>
    </div>
  );
};

export default CalendarCallback;
