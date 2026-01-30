import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    
    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all completed recordings for context
    const { data: recordings, error: recordingsError } = await supabase
      .from("recordings")
      .select("title, created_at, duration, summary, key_points, action_items, transcript_text, participants")
      .eq("user_id", user.id)
      .eq("status", "done")
      .order("created_at", { ascending: false })
      .limit(30);

    if (recordingsError) {
      console.error("Error fetching recordings:", recordingsError);
    }

    // Build context from recordings
    let meetingContext = "Keine Meetings gefunden.";
    if (recordings && recordings.length > 0) {
      meetingContext = recordings.map((r, i) => {
        const date = new Date(r.created_at).toLocaleDateString("de-DE");
        const duration = r.duration ? Math.round(r.duration / 60) : 0;
        const keyPoints = r.key_points?.join(", ") || "Keine";
        const actionItems = r.action_items?.join(", ") || "Keine";
        
        // Include transcript excerpt for context (first 500 chars)
        const transcriptExcerpt = r.transcript_text 
          ? r.transcript_text.substring(0, 500) + "..." 
          : "Kein Transkript";
        
        return `
Meeting ${i + 1}: "${r.title || 'Unbenannt'}"
- Datum: ${date}
- Dauer: ${duration} Minuten
- Zusammenfassung: ${r.summary || 'Keine Zusammenfassung'}
- Key Points: ${keyPoints}
- Action Items: ${actionItems}
- Transkript-Auszug: ${transcriptExcerpt}
`;
      }).join("\n---\n");
    }

    const systemPrompt = `Du bist ein hilfreicher Meeting-Assistent. Du hast Zugriff auf alle Meetings des Nutzers und kannst Fragen dazu beantworten.

WICHTIGE REGELN:
1. Antworte immer auf Deutsch, kurz und prägnant.
2. Verwende KEINE Sternchen (*) oder Markdown-Formatierung. Schreibe in normalem Fließtext.
3. Wenn eine Frage zu allgemein oder unklar ist, stelle eine konkrete Rückfrage um die Anfrage einzugrenzen.
4. Beziehe dich auf konkrete Meeting-Inhalte, Daten und Namen wenn möglich.
5. Wenn du mehrere Punkte aufzählst, nummeriere sie (1., 2., 3.) statt Aufzählungszeichen.
6. Gib immer eine konkrete, umsetzbare Antwort - keine vagen Zusammenfassungen.

Hier sind die Meetings des Nutzers:

${meetingContext}

Beantworte Fragen zu diesen Meetings. Wenn du etwas nicht weißt, sage es ehrlich.`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("meeting-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
