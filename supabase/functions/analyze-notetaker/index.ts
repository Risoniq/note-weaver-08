import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "Nicht autorisiert" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: "Nicht autorisiert" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { transcript, title, recording_id } = await req.json();

    if (!transcript || transcript.trim().length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: "Kein Transkript vorhanden"
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({
        success: false,
        error: "LOVABLE_API_KEY nicht konfiguriert"
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const systemPrompt = `Du bist ein Experte für Meeting-Analyse. Kommuniziere auf Deutsch. Verwende KEINE Markdown-Sterne für Fettdruck. Listen verwenden nummerierte Formate.

Analysiere das folgende Meeting-Transkript und erstelle eine umfassende Analyse.

WICHTIG für Action Items: Eine Aufgabe muss mindestens zwei von drei Kriterien erfüllen:
1. Klare, konkrete Handlungsanweisung
2. Namentlich genannter Verantwortlicher
3. Zeitrahmen oder Deadline
Vage Absichten, Wünsche oder einfache Kommentare werden NICHT als Action Items aufgenommen. Maximal 8 Action Items.

Antworte NUR mit dem Tool-Call, keine zusätzliche Erklärung.`;

    const userPrompt = `Meeting-Titel: ${title || "Ohne Titel"}

Transkript:
${transcript}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        temperature: 0,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "meeting_analysis",
              description: "Vollständige Meeting-Analyse mit Risikoanalyse zurückgeben",
              parameters: {
                type: "object",
                properties: {
                  summary: { type: "string", description: "Zusammenfassung in 2-3 Sätzen" },
                  keyPoints: { type: "array", items: { type: "string" }, description: "3-5 wichtigste Punkte" },
                  actionItems: { type: "array", items: { type: "string" }, description: "Konkrete Aufgaben mit Verantwortlichen (max 8)" }
                },
                required: ["summary", "keyPoints", "actionItems"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "meeting_analysis" } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(JSON.stringify({
          success: false,
          error: "Rate Limit erreicht. Bitte versuche es in einer Minute erneut."
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({
          success: false,
          error: "KI-Credits aufgebraucht. Bitte Credits aufladen."
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({
        success: false,
        error: "KI-Analyse fehlgeschlagen"
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      console.error("No tool call in response:", JSON.stringify(aiResult));
      return new Response(JSON.stringify({
        success: false,
        error: "KI hat keine strukturierte Antwort geliefert"
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const analysis = JSON.parse(toolCall.function.arguments);
    const words = transcript.split(/\s+/);
    const wordCount = words.length;

    // If recording_id provided, update the recording directly
    if (recording_id) {
      const { error: updateError } = await supabaseAdmin
        .from('recordings')
        .update({
          summary: analysis.summary || null,
          key_points: analysis.keyPoints || [],
          action_items: analysis.actionItems || [],
          word_count: wordCount,
        })
        .eq('id', recording_id)
        .eq('user_id', user.id);

      if (updateError) {
        console.error("DB update error:", updateError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      analysis: {
        summary: analysis.summary || "Keine Zusammenfassung verfügbar",
        keyPoints: analysis.keyPoints || [],
        actionItems: analysis.actionItems || [],
        wordCount,
      }
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("analyze-notetaker error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unbekannter Fehler"
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
