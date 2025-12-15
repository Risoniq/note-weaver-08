import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Bot, Send, Loader2 } from "lucide-react";

interface MeetingBotProps {
  onMeetingCreated: (meetingId: string) => void;
}

export function MeetingBot({ onMeetingCreated }: MeetingBotProps) {
  const [meetingUrl, setMeetingUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

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
      const { data, error } = await supabase.functions.invoke("create-bot", {
        body: { meetingUrl },
      });

      if (error) throw error;

      toast({
        title: "Erfolgreich",
        description: "Bot wurde zum Meeting gesendet!",
      });

      if (data?.meetingId) {
        onMeetingCreated(data.meetingId);
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
