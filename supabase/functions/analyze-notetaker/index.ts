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

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({
        success: false,
        error: "ANTHROPIC_API_KEY nicht konfiguriert"
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const systemPrompt = `Du bist ein Experte für Meeting-Analyse. Kommuniziere auf Deutsch. Verwende KEINE Markdown-Sterne für Fettdruck. Listen verwenden nummerierte Formate.

Analysiere das folgende Meeting-Transkript und erstelle eine umfassende Analyse.

WICHTIG für Action Items: Eine Aufgabe muss mindestens zwei von drei Kriterien erfüllen:
1. Klare, konkrete Handlungsanweisung
2. Namentlich genannter Verantwortlicher
3. Zeitrahmen oder Deadline
Vage Absichten, Wünsche oder einfache Kommentare werden NICHT als Action Items aufgenommen. Maximal 8 Action Items.

Du MUSST deine Antwort als JSON-Objekt mit folgender Struktur zurückgeben:
{
  "summary": "Zusammenfassung in 2-3 Sätzen",
  "keyPoints": ["Punkt 1", "Punkt 2", ...],
  "actionItems": ["Aufgabe 1 (Verantwortlicher: Name)", ...]
}

Antworte NUR mit dem JSON, keine zusätzliche Erklärung.`;

    const userPrompt = `Meeting-Titel: ${title || "Ohne Titel"}

Transkript:
${transcript}`;

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
        messages: [
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Anthropic API error:", response.status, errorText);

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
    const content = aiResult.content?.[0]?.text;

    if (!content) {
      console.error("No content in Anthropic response:", JSON.stringify(aiResult));
      return new Response(JSON.stringify({
        success: false,
        error: "KI hat keine Antwort geliefert"
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Parse JSON from response
    let analysis;
    try {
      let jsonStr = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      if (!jsonStr.startsWith('{')) {
        const startIdx = jsonStr.indexOf('{');
        const endIdx = jsonStr.lastIndexOf('}');
        if (startIdx !== -1 && endIdx !== -1) jsonStr = jsonStr.slice(startIdx, endIdx + 1);
      }
      analysis = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI response:", content.substring(0, 500));
      return new Response(JSON.stringify({
        success: false,
        error: "KI hat keine strukturierte Antwort geliefert"
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const words = transcript.split(/\s+/);
    const wordCount = words.length;

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
