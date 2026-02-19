import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Bot, Send, Loader2, AlertTriangle } from "lucide-react";

interface MeetingBotProps {
  onRecordingCreated: (recordingId: string) => void;
}

export function MeetingBot({ onRecordingCreated }: MeetingBotProps) {
  const [meetingUrl, setMeetingUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Erkennung von externen Teams-Meetings (Business/Enterprise)
  const isExternalTeamsMeeting = useMemo(() => {
    const url = meetingUrl.toLowerCase();
    // teams.microsoft.com/meet/ ist die neue URL-Struktur für Business/Enterprise
    // teams.live.com ist für persönliche Konten (funktioniert besser)
    return url.includes('teams.microsoft.com/meet/') || 
           url.includes('teams.microsoft.com/l/meetup-join');
  }, [meetingUrl]);

  const handleSendBot = async () => {
    if (!meetingUrl.trim()) {
      toast({
        title: "Fehler",
        description: "Bitte gib eine Meeting-URL ein.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Get bot settings from localStorage
      const botName = localStorage.getItem('bot:name') || 'Notetaker Bot';
      const botAvatarUrl = localStorage.getItem('bot:avatarUrl') || null;
      
      console.log('[MeetingBot] Sende Bot mit Einstellungen:', { botName, botAvatarUrl });
      
      const { data, error } = await supabase.functions.invoke("create-bot", {
        body: { meetingUrl, botName, botAvatarUrl },
      });

      if (error) throw error;

      toast({
        title: "Erfolgreich",
        description: isExternalTeamsMeeting 
          ? "Bot wurde gesendet! Der Meeting-Host muss den Bot aus dem Wartebereich lassen."
          : "Bot wurde zum Meeting gesendet!",
      });

      // Nutze die Recording UUID (id) für sync-recording
      const recordingId = data?.recording?.id;
      if (recordingId) {
        onRecordingCreated(recordingId);
      }
      
      setMeetingUrl("");
    } catch (error: any) {
      console.error("Error sending bot:", error);
      toast({
        title: "Fehler",
        description: error.message || "Bot konnte nicht gesendet werden.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-6 w-6 text-primary" />
          Meeting Bot
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3">
          <Input
            placeholder="Meeting-URL eingeben (z.B. https://meet.google.com/...)"
            value={meetingUrl}
            onChange={(e) => setMeetingUrl(e.target.value)}
            onPaste={(e) => {
              const plainText = e.clipboardData.getData('text/plain');
              const htmlText = e.clipboardData.getData('text/html');
              let url = plainText?.trim() || '';
              if (!url && htmlText) {
                const match = htmlText.match(/https?:\/\/[^\s"<>]+/);
                if (match) url = match[0];
              }
              if (url) {
                e.preventDefault();
                setMeetingUrl(url);
              }
            }}
            disabled={isLoading}
            className="flex-1"
          />
          <Button onClick={handleSendBot} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Bot senden
              </>
            )}
          </Button>
        </div>
        
        {isExternalTeamsMeeting && (
          <Alert className="border-amber-500 bg-amber-500/10">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <AlertDescription className="text-sm">
              <strong>Externes Teams-Meeting erkannt:</strong> Bei Microsoft Teams Business/Enterprise 
              Meetings muss der Meeting-Host den Bot manuell aus dem Wartebereich lassen. 
              Der Bot erscheint möglicherweise als "Unverified".
            </AlertDescription>
          </Alert>
        )}
        
        <p className="text-sm text-muted-foreground">
          Füge die URL deines Meetings ein, um den Aufnahme-Bot zu starten.
        </p>
      </CardContent>
    </Card>
  );
}
