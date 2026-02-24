import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Convert Anthropic SSE stream to OpenAI-compatible SSE stream
function convertAnthropicStream(anthropicBody: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const reader = anthropicBody.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return new ReadableStream({
    async pull(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;
            try {
              const event = JSON.parse(jsonStr);
              if (event.type === "content_block_delta" && event.delta?.text) {
                const openAIChunk = {
                  choices: [{ delta: { content: event.delta.text }, index: 0 }],
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(openAIChunk)}\n\n`));
              } else if (event.type === "message_stop") {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                controller.close();
                return;
              }
            } catch { /* skip unparseable */ }
          }
        }
      }
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, transcript, meetingTitle, summary, keyPoints, actionItems } = await req.json();
    
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

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    const userMessages = messages.filter((m: any) => m.role !== "system");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        messages: userMessages,
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
      console.error("Anthropic API error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openAIStream = convertAnthropicStream(response.body!);

    return new Response(openAIStream, {
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
