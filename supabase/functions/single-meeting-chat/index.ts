import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, transcript, meetingTitle, summary, keyPoints, actionItems } = await req.json();
    
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

    // Build context from this specific meeting
    let meetingContext = "Kein Transkript verfügbar.";
    
    if (transcript) {
      const keyPointsText = keyPoints?.length > 0 ? keyPoints.join("\n- ") : "Keine";
      const actionItemsText = actionItems?.length > 0 ? actionItems.join("\n- ") : "Keine";
      
      meetingContext = `
MEETING-TITEL: ${meetingTitle || 'Unbenannt'}

ZUSAMMENFASSUNG:
${summary || 'Keine Zusammenfassung verfügbar'}

KEY POINTS:
- ${keyPointsText}

ACTION ITEMS:
- ${actionItemsText}

VOLLSTÄNDIGES TRANSKRIPT:
${transcript}
`;
    }

    const systemPrompt = `Du bist ein hilfreicher Meeting-Assistent. Du hast Zugriff auf das vollständige Transkript und alle Details eines spezifischen Meetings.

WICHTIGE REGELN:
1. Antworte immer auf Deutsch, kurz und prägnant.
2. Verwende KEINE Sternchen (*) oder Markdown-Formatierung. Schreibe in normalem Fließtext.
3. Wenn eine Frage zu allgemein oder unklar ist, stelle eine konkrete Rückfrage um die Anfrage einzugrenzen.
4. Beziehe dich auf konkrete Inhalte aus dem Transkript, Zitate, Namen und Aussagen.
5. Bei Aufzählungen: Jeder Punkt beginnt auf einer NEUEN ZEILE mit Nummer und Punkt (z.B. "1. Erster Punkt").
6. Halte jeden Aufzählungspunkt kurz (max. 1-2 Sätze) und setze danach einen Zeilenumbruch.
7. Gib immer eine konkrete, umsetzbare Antwort - keine langen Absätze.
8. Du kannst direkt aus dem Transkript zitieren wenn es hilfreich ist.

Hier sind die vollständigen Informationen zu diesem Meeting:

${meetingContext}

Beantworte Fragen zu diesem Meeting. Wenn du etwas nicht im Transkript findest, sage es ehrlich.`;

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
    console.error("single-meeting-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
