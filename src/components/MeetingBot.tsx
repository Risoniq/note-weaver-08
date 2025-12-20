import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { Bot, Send, Loader2 } from "lucide-react";

interface MeetingBotProps {
  onRecordingCreated: (recordingId: string) => void;
}

export function MeetingBot({ onRecordingCreated }: MeetingBotProps) {
  const [meetingUrl, setMeetingUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [botAvatarUrl, setBotAvatarUrl] = useState<string | null>(null);
  const [botName, setBotName] = useState("Notetaker Bot");
  const { toast } = useToast();

  useEffect(() => {
    const storedAvatar = localStorage.getItem('bot:avatarUrl');
    const storedName = localStorage.getItem('bot:name');
    if (storedAvatar) setBotAvatarUrl(storedAvatar);
    if (storedName) setBotName(storedName);
  }, []);

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
      
      const { data, error } = await supabase.functions.invoke("create-bot", {
        body: { meetingUrl, botName, botAvatarUrl },
      });

      if (error) throw error;

      toast({
        title: "Erfolgreich",
        description: "Bot wurde zum Meeting gesendet!",
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
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-6 w-6 text-primary" />
            Meeting Bot
          </CardTitle>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link 
                  to="/settings" 
                  className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors group"
                >
                  <Avatar className="h-10 w-10 border-2 border-primary/20 group-hover:border-primary/40 transition-colors">
                    {botAvatarUrl ? (
                      <AvatarImage src={botAvatarUrl} alt={botName} />
                    ) : null}
                    <AvatarFallback className="bg-primary/10 text-primary">
                      <Bot className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{botName}</span>
                    <span className="text-xs text-muted-foreground">
                      {botAvatarUrl ? "Profilbild aktiv" : "Kein Profilbild"}
                    </span>
                  </div>
                  
                </Link>
              </TooltipTrigger>
              <TooltipContent>
                <p>In Einstellungen ändern</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3">
          <Input
            placeholder="Meeting-URL eingeben (z.B. https://meet.google.com/...)"
            value={meetingUrl}
            onChange={(e) => setMeetingUrl(e.target.value)}
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
        <p className="text-sm text-muted-foreground">
          Füge die URL deines Meetings ein, um den Aufnahme-Bot zu starten.
        </p>
      </CardContent>
    </Card>
  );
}
