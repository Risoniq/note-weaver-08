import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Not authenticated");

    const { projectId } = await req.json();
    if (!projectId) throw new Error("projectId required");

    const { data: project, error: projError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (projError || !project) throw new Error("Project not found");

    const { data: prLinks } = await supabase
      .from("project_recordings")
      .select("recording_id")
      .eq("project_id", projectId);

    if (!prLinks?.length) throw new Error("No recordings assigned");

    const recIds = prLinks.map((l: any) => l.recording_id);
    const { data: recordings } = await supabase
      .from("recordings")
      .select("title, summary, key_points, action_items, transcript_text, duration, created_at")
      .in("id", recIds)
      .order("created_at", { ascending: true });

    if (!recordings?.length) throw new Error("No recordings found");

    const meetingSummaries = recordings.map((r: any, i: number) => {
      return `Meeting ${i + 1}: "${r.title || 'Ohne Titel'}" (${new Date(r.created_at).toLocaleDateString("de-DE")})
Zusammenfassung: ${r.summary || 'Keine'}
Key Points: ${(r.key_points || []).join(", ") || 'Keine'}
Action Items: ${(r.action_items || []).join(", ") || 'Keine'}`;
    }).join("\n\n");

    const prompt = `Analysiere die folgenden ${recordings.length} Meetings des Projekts "${project.name}":

${meetingSummaries}

Erstelle eine JSON-Antwort mit:
- "summary": Eine Gesamtzusammenfassung des Projektstands (2-3 Sätze)
- "progress": Bewertung des Fortschritts (1-2 Sätze)
- "open_topics": Array mit offenen Themen
- "completed_topics": Array mit erledigten Themen
- "recommendations": Array mit 3-5 konkreten Empfehlungen für die nächsten Schritte
- "topic_tracking": Array von Objekten mit {"topic": "Thema-Name", "meetings": [1, 3, 5], "status": "verfolgt"|"offen"|"erledigt"}
- "domain_distribution": Array von Objekten mit {"meeting": "Meeting-Titel kurz", "marketing": 20, "produkt": 40, "sales": 30, "operations": 10}
- "speaker_domain_activity": Array von {"speaker": "Sprecher-Name", "marketing": 15, "produkt": 50, "sales": 25, "operations": 10}

Antworte NUR mit validem JSON.`;

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("AI not configured");

    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: "Du bist ein Projektanalyse-Assistent. Antworte immer in validem JSON auf Deutsch.",
        messages: [
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) throw new Error("Rate limit - bitte versuche es später erneut");
      if (status === 402) throw new Error("Kein AI-Guthaben verfügbar");
      throw new Error("AI-Analyse fehlgeschlagen");
    }

    const aiData = await aiResponse.json();
    let analysisText = aiData.content?.[0]?.text || "";
    
    analysisText = analysisText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    
    let analysis;
    try {
      analysis = JSON.parse(analysisText);
    } catch {
      analysis = { summary: analysisText, progress: "", open_topics: [], completed_topics: [], recommendations: [] };
    }

    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await serviceClient.from("projects").update({ analysis }).eq("id", projectId);

    return new Response(JSON.stringify({ success: true, analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
