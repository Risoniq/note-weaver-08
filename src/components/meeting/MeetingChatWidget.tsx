import { useState, useRef, useEffect } from "react";
import { Send, MessageCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { VoiceInputButton } from "@/components/ui/VoiceInputButton";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface MeetingChatWidgetProps {
  transcript: string | null;
  meetingTitle?: string;
  summary?: string;
  keyPoints?: string[];
  actionItems?: string[];
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/single-meeting-chat`;

export const MeetingChatWidget = ({ 
  transcript, 
  meetingTitle,
  summary,
  keyPoints,
  actionItems 
}: MeetingChatWidgetProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const streamChat = async (userMessage: string) => {
    const userMsg: Message = { role: "user", content: userMessage };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast({
          variant: "destructive",
          title: "Nicht angemeldet",
          description: "Bitte melde dich an um den Chat zu nutzen."
        });
        setIsLoading(false);
        return;
      }

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          messages: [...messages, userMsg],
          transcript,
          meetingTitle,
          summary,
          keyPoints,
          actionItems
        })
      });

      if (resp.status === 429) {
        toast({
          variant: "destructive",
          title: "Rate Limit",
          description: "Zu viele Anfragen. Bitte warte kurz."
        });
        setIsLoading(false);
        return;
      }

      if (resp.status === 402) {
        toast({
          variant: "destructive",
          title: "Limit erreicht",
          description: "Bitte füge Credits hinzu."
        });
        setIsLoading(false);
        return;
      }

      if (!resp.ok || !resp.body) {
        throw new Error("Failed to start stream");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let assistantContent = "";
      let streamDone = false;

      // Add empty assistant message
      setMessages(prev => [...prev, { role: "assistant", content: "" }]);

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              setMessages(prev => prev.map((m, i) => 
                i === prev.length - 1 ? { ...m, content: assistantContent } : m
              ));
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Chat konnte nicht gestartet werden."
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    streamChat(input.trim());
    setInput("");
  };

  if (!transcript) {
    return null;
  }

  return (
    <div className="rounded-xl p-4 bg-secondary-foreground">
      <h3 className="font-medium mb-3 flex items-center gap-2 text-primary-foreground">
        <MessageCircle className="h-4 w-4 text-primary" />
        Fragen zu diesem Meeting
      </h3>
      
      {/* Messages Area */}
      <ScrollArea className="h-48 mb-3 pr-2" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="text-center text-primary-foreground text-sm py-8">
            <p>Stelle Fragen zu diesem Meeting:</p>
            <p className="text-xs mt-2 opacity-70">
              z.B. "Was war das Hauptthema?" oder "Welche Entscheidungen wurden getroffen?"
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg, i) => (
              <div 
                key={i} 
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div 
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                    msg.role === "user" 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-background/70 border"
                  }`}
                >
                  {msg.content || <Loader2 className="h-4 w-4 animate-spin" />}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input 
          value={input} 
          onChange={e => setInput(e.target.value)} 
          placeholder="Frag etwas über dieses Meeting..." 
          disabled={isLoading} 
          className="flex-1 bg-background/50" 
        />
        <VoiceInputButton 
          onTranscript={(text) => setInput(prev => prev ? `${prev} ${text}` : text)}
          disabled={isLoading}
        />
        <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
};
