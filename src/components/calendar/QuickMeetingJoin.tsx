import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bot, Loader2, Video } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface QuickMeetingJoinProps {
  onBotStarted?: () => void;
}

export const QuickMeetingJoin = ({ onBotStarted }: QuickMeetingJoinProps) => {
  const [meetingUrl, setMeetingUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
      const botName = localStorage.getItem('bot:name') || 'Meeting Bot';
      const botAvatarUrl = localStorage.getItem('bot:avatarUrl') || undefined;

      const { data, error } = await supabase.functions.invoke('create-bot', {
        body: {
          meetingUrl: meetingUrl.trim(),
          botName,
          botAvatarUrl,
        },
      });

      if (error) throw error;

      toast({
        title: 'Bot gestartet',
        description: `Bot tritt dem Meeting bei: ${data?.meetingTitle || 'Meeting'}`,
      });

      setMeetingUrl('');
      onBotStarted?.();
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
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Video size={18} className="text-muted-foreground" />
        <h3 className="font-medium text-foreground">Bot zu Meeting senden</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Füge eine Meeting-URL ein, um den Bot sofort beizutreten zu lassen.
      </p>
      <div className="flex gap-2">
        <Input
          placeholder="https://meet.google.com/... oder Teams/Zoom Link"
          value={meetingUrl}
          onChange={(e) => setMeetingUrl(e.target.value)}
          disabled={isLoading}
          className="flex-1"
        />
        <Button
          onClick={handleSendBot}
          disabled={isLoading || !meetingUrl.trim()}
          size="default"
        >
          {isLoading ? (
            <Loader2 size={16} className="animate-spin mr-2" />
          ) : (
            <Bot size={16} className="mr-2" />
          )}
          Senden
        </Button>
      </div>
    </div>
  );
};
