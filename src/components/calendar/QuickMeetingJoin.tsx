import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Bot, Loader2, Video, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { withTokenRefresh } from '@/lib/retryWithTokenRefresh';

interface QuickMeetingJoinProps {
  onBotStarted?: (recordingId?: string) => void;
}

export const QuickMeetingJoin = ({ onBotStarted }: QuickMeetingJoinProps) => {
  const [meetingUrl, setMeetingUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Erkennung von externen Teams-Meetings (Business/Enterprise)
  const isExternalTeamsMeeting = useMemo(() => {
    const url = meetingUrl.toLowerCase();
    return url.includes('teams.microsoft.com/meet/') || 
           url.includes('teams.microsoft.com/l/meetup-join');
  }, [meetingUrl]);

  const isValidMeetingUrl = (url: string): boolean => {
    const patterns = [
      /meet\.google\.com/i,
      /teams\.microsoft\.com/i,
      /teams\.live\.com/i,
      /zoom\.us/i,
      /webex\.com/i,
    ];
    return patterns.some((pattern) => pattern.test(url));
  };

  const handleSendBot = async () => {
    if (!meetingUrl.trim()) {
      toast({
        title: 'Fehler',
        description: 'Bitte gib eine Meeting-URL ein.',
        variant: 'destructive',
      });
      return;
    }

    if (!isValidMeetingUrl(meetingUrl)) {
      toast({
        title: 'Ungültige URL',
        description: 'Bitte gib eine gültige Meeting-URL ein (Google Meet, Teams, Zoom, Webex).',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const botName = localStorage.getItem('bot:name') || 'Notetaker Bot';
      const botAvatarUrl = localStorage.getItem('bot:avatarUrl') || null;

      console.log('[QuickMeetingJoin] Sende Bot mit Einstellungen:', { botName, botAvatarUrl });

      const { data, error } = await withTokenRefresh(
        () => supabase.functions.invoke('create-bot', {
          body: {
            meetingUrl: meetingUrl.trim(),
            botName,
            botAvatarUrl,
          },
        })
      );

      if (error) throw error;

      toast({
        title: 'Bot gestartet',
        description: isExternalTeamsMeeting 
          ? 'Bot wurde gesendet! Der Meeting-Host muss den Bot aus dem Wartebereich lassen.'
          : `Bot tritt dem Meeting bei: ${data?.meetingTitle || 'Meeting'}`,
      });

      // Recording-ID aus Response extrahieren und via Callback zurückgeben
      const recordingId = data?.recording?.id;
      setMeetingUrl('');
      onBotStarted?.(recordingId);
    } catch (error) {
      console.error('Error sending bot:', error);
      toast({
        title: 'Fehler',
        description: 'Bot konnte nicht gestartet werden. Bitte versuche es erneut.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Gradient Akzent-Linie */}
      <div className="h-1 bg-gradient-to-r from-primary/40 via-primary to-primary/40 rounded-full" />
      
      {/* Header mit animiertem Icon */}
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-2xl bg-primary/10 animate-subtle-pulse">
          <Bot size={24} className="text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">Bot zu Meeting senden</h3>
          <p className="text-sm text-muted-foreground">Sofort aufnehmen lassen</p>
        </div>
      </div>
      
      {/* Input und Button */}
      <div className="flex gap-2">
        <Input
          placeholder="https://meet.google.com/... oder Teams/Zoom Link"
          value={meetingUrl}
          onChange={(e) => setMeetingUrl(e.target.value)}
          disabled={isLoading}
          className="flex-1 h-11"
        />
        <Button
          onClick={handleSendBot}
          disabled={isLoading || !meetingUrl.trim()}
          size="lg"
          className="shadow-primary/20 shadow-lg hover:shadow-primary/30 transition-shadow"
        >
          {isLoading ? (
            <Loader2 size={18} className="animate-spin mr-2" />
          ) : (
            <Bot size={18} className="mr-2" />
          )}
          Senden
        </Button>
      </div>
      
      {/* Unterstützte Plattformen */}
      <p className="text-xs text-muted-foreground text-center">
        Unterstützt: Google Meet • Teams • Zoom • Webex
      </p>
      
      {isExternalTeamsMeeting && (
        <Alert className="border-warning bg-warning/10">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertDescription className="text-sm">
            <strong>Externes Teams-Meeting erkannt:</strong> Bei Microsoft Teams Business/Enterprise 
            Meetings muss der Meeting-Host den Bot manuell aus dem Wartebereich lassen. 
            Der Bot erscheint möglicherweise als "Unverified".
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
