import { Plus, MessageCircle, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

interface ChatSession {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

interface ChatHistorySidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const ChatHistorySidebar = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  isOpen,
  onToggle,
}: ChatHistorySidebarProps) => {
  if (!isOpen) {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggle}
        className="shrink-0 h-8 w-8"
        title="Verlauf anzeigen"
      >
        <History className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <div className="w-40 shrink-0 border-r mr-1 flex flex-col h-full">
      <div className="flex items-center justify-between p-2 border-b">
        <span className="text-xs font-medium text-muted-foreground">Verlauf</span>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={onNewChat} className="h-6 w-6" title="Neuer Chat">
            <Plus className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onToggle} className="h-6 w-6" title="Verlauf ausblenden">
            <History className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-1 space-y-0.5">
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => onSelectSession(s.id)}
              className={cn(
                "w-full text-left rounded px-2 py-1.5 text-xs transition-colors hover:bg-accent",
                s.id === activeSessionId && "bg-accent font-medium"
              )}
            >
              <div className="truncate">
                {s.title || "Neuer Chat"}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {formatDistanceToNow(new Date(s.updated_at), { addSuffix: true, locale: de })}
              </div>
            </button>
          ))}
          {sessions.length === 0 && (
            <div className="text-xs text-muted-foreground text-center py-4">
              <MessageCircle className="h-4 w-4 mx-auto mb-1 opacity-50" />
              Noch keine Chats
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
