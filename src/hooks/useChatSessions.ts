import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatSession {
  id: string;
  title: string | null;
  messages: Message[];
  created_at: string;
  updated_at: string;
}

interface UseChatSessionsOptions {
  contextType: "dashboard" | "meeting" | "project";
  contextId?: string;
}

export function useChatSessions({ contextType, contextId }: UseChatSessionsOptions) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load all sessions for this context
  const loadSessions = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    let query = supabase
      .from("chat_sessions" as any)
      .select("*")
      .eq("user_id", session.user.id)
      .eq("context_type", contextType)
      .order("updated_at", { ascending: false })
      .limit(20);

    if (contextId) {
      query = query.eq("context_id", contextId);
    } else {
      query = query.is("context_id", null);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Failed to load chat sessions:", error);
      return;
    }

    const loaded = (data || []).map((d: any) => ({
      id: d.id,
      title: d.title,
      messages: (d.messages || []) as Message[],
      created_at: d.created_at,
      updated_at: d.updated_at,
    }));

    setSessions(loaded);
    return loaded;
  }, [contextType, contextId]);

  // Initialize: load sessions and set active
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      const loaded = await loadSessions();
      if (cancelled) return;
      if (loaded && loaded.length > 0) {
        setActiveSessionId(loaded[0].id);
        setMessages(loaded[0].messages);
      }
      setIsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [loadSessions]);

  // Load a specific session
  const loadSession = useCallback((id: string) => {
    const found = sessions.find(s => s.id === id);
    if (found) {
      setActiveSessionId(found.id);
      setMessages(found.messages);
    }
  }, [sessions]);

  // Save messages to active session
  const saveMessages = useCallback(async (msgs: Message[]) => {
    if (!activeSessionId) return;

    const title = msgs.find(m => m.role === "user")?.content?.slice(0, 40) || null;
    const titleWithEllipsis = title && title.length >= 40 ? title + "…" : title;

    const { error } = await supabase
      .from("chat_sessions" as any)
      .update({ messages: msgs as any, title: titleWithEllipsis } as any)
      .eq("id", activeSessionId);

    if (error) console.error("Failed to save chat session:", error);

    // Refresh local list
    setSessions(prev => prev.map(s =>
      s.id === activeSessionId
        ? { ...s, messages: msgs, title: titleWithEllipsis, updated_at: new Date().toISOString() }
        : s
    ));
  }, [activeSessionId]);

  // Create new chat
  const createNewChat = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data, error } = await supabase
      .from("chat_sessions" as any)
      .insert({
        user_id: session.user.id,
        context_type: contextType,
        context_id: contextId || null,
        messages: [],
      } as any)
      .select()
      .single();

    if (error || !data) {
      console.error("Failed to create chat session:", error);
      return;
    }

    const newSession: ChatSession = {
      id: (data as any).id,
      title: null,
      messages: [],
      created_at: (data as any).created_at,
      updated_at: (data as any).updated_at,
    };

    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setMessages([]);
    return newSession.id;
  }, [contextType, contextId]);

  // Ensure an active session exists (lazy create)
  const ensureSession = useCallback(async () => {
    if (activeSessionId) return activeSessionId;
    return await createNewChat();
  }, [activeSessionId, createNewChat]);

  // Clear/delete current session
  const clearChat = useCallback(async () => {
    if (activeSessionId) {
      await supabase
        .from("chat_sessions" as any)
        .delete()
        .eq("id", activeSessionId);

      setSessions(prev => prev.filter(s => s.id !== activeSessionId));
    }
    setMessages([]);
    setActiveSessionId(null);
    // Create a fresh session
    await createNewChat();
  }, [activeSessionId, createNewChat]);

  return {
    sessions,
    activeSessionId,
    messages,
    setMessages,
    isLoading,
    loadSession,
    saveMessages,
    createNewChat,
    ensureSession,
    clearChat,
  };
}
