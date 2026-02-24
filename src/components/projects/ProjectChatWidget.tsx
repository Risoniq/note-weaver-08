import { useState, useRef, useEffect } from "react";
import { Send, MessageCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { VoiceInputButton } from "@/components/ui/VoiceInputButton";
import { ChatHistorySidebar } from "@/components/chat/ChatHistorySidebar";
import { useToast } from "@/hooks/use-toast";
import { useChatSessions } from "@/hooks/useChatSessions";
import { supabase } from "@/integrations/supabase/client";

interface ProjectChatWidgetProps {
  projectId: string;
  projectName: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/project-chat`;

export const ProjectChatWidget = ({ projectId, projectName }: ProjectChatWidgetProps) => {
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const {
    sessions, activeSessionId, messages, setMessages,
    loadSession, saveMessages, createNewChat, ensureSession, clearChat,
  } = useChatSessions({ contextType: "project", contextId: projectId });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const streamChat = async (userMessage: string) => {
    if (userMessage === "/clear") {
      await clearChat();
      toast({ title: "Chat gelöscht", description: "Neuer Chat wurde gestartet." });
      return;
    }

    await ensureSession();

    const userMsg = { role: "user" as const, content: userMessage };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setIsStreaming(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast({ variant: "destructive", title: "Nicht angemeldet", description: "Bitte melde dich an." });
        setIsStreaming(false);
        return;
      }

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ projectId, messages: updatedMessages }),
      });

      if (resp.status === 429) { toast({ variant: "destructive", title: "Rate Limit", description: "Zu viele Anfragen." }); setIsStreaming(false); return; }
      if (resp.status === 402) { toast({ variant: "destructive", title: "Limit erreicht", description: "Bitte füge Credits hinzu." }); setIsStreaming(false); return; }
      if (!resp.ok || !resp.body) throw new Error("Failed to start stream");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let assistantContent = "";
      let streamDone = false;

      setMessages([...updatedMessages, { role: "assistant", content: "" }]);

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
          if (jsonStr === "[DONE]") { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m));
            }
          } catch { textBuffer = line + "\n" + textBuffer; break; }
        }
      }

      const finalMessages = [...updatedMessages, { role: "assistant" as const, content: assistantContent }];
      setMessages(finalMessages);
      await saveMessages(finalMessages);
    } catch (error) {
      console.error("Project chat error:", error);
      toast({ variant: "destructive", title: "Fehler", description: "Chat konnte nicht gestartet werden." });
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    streamChat(input.trim());
    setInput("");
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
        <MessageCircle className="h-4 w-4 text-primary" />
        Projekt-Strategie-Chat
      </h4>

      <div className="flex gap-0 h-64">
        <ChatHistorySidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={loadSession}
          onNewChat={createNewChat}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(o => !o)}
        />
        <ScrollArea className="flex-1 pr-2" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-6">
              <p>Frag nach Projektpotentialen, Risiken oder strategischen Empfehlungen...</p>
              <p className="text-xs mt-2 opacity-70">z.B. "Welche Risiken siehst du?"</p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                    msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted border"
                  }`}>
                    {msg.content || <Loader2 className="h-4 w-4 animate-spin" />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input value={input} onChange={e => setInput(e.target.value)} placeholder="Strategische Frage zum Projekt stellen..." disabled={isStreaming} className="flex-1" />
        <VoiceInputButton onTranscript={(text) => setInput(prev => prev ? `${prev} ${text}` : text)} disabled={isStreaming} />
        <Button type="submit" size="icon" disabled={isStreaming || !input.trim()}>
          {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
};
