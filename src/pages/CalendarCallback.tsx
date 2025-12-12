import { useEffect } from 'react';

const CalendarCallback = () => {
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');

    if (window.opener) {
      window.opener.postMessage(
        {
          type: 'google-auth-callback',
          code,
          error: error || undefined,
        },
        window.location.origin
      );
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
