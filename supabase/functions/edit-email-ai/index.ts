import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, instructions, recording_context } = await req.json();

    if (!email || !instructions) {
      return new Response(
        JSON.stringify({ error: "E-Mail und Anweisungen sind erforderlich" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "API-Schlüssel nicht konfiguriert" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `Du bist ein professioneller E-Mail-Assistent für geschäftliche Korrespondenz.
Deine Aufgabe ist es, Follow-Up E-Mails nach Meetings zu bearbeiten und zu verbessern.

Wichtige Regeln:
- Behalte den professionellen, freundlichen Ton bei
- Keine Markdown-Formatierung (keine Sterne, keine Hashtags)
- Keine sensiblen Daten wie Passwörter einfügen
- Halte die Struktur der E-Mail bei (Betreff, Anrede, Inhalt, Grußformel)
- Die E-Mail sollte in deutscher Sprache sein
- Füge keine erfundenen Informationen hinzu - basiere alles auf dem Kontext`;

    const userPrompt = `Hier ist die aktuelle Follow-Up E-Mail:

---
${email}
---

${recording_context ? `
Kontext zum Meeting:
- Titel: ${recording_context.title || 'Unbekannt'}
- Zusammenfassung: ${recording_context.summary || 'Keine Zusammenfassung'}
- Key Points: ${recording_context.key_points?.join(', ') || 'Keine'}
- Action Items: ${recording_context.action_items?.join(', ') || 'Keine'}
` : ''}

Bitte bearbeite die E-Mail nach folgenden Anweisungen:
${instructions}

Gib NUR die bearbeitete E-Mail zurück, ohne zusätzliche Erklärungen oder Formatierung.`;

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
          { role: "user", content: userPrompt }
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Zu viele Anfragen, bitte versuche es später erneut." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Credits aufgebraucht, bitte Guthaben aufladen." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "KI-Service vorübergehend nicht verfügbar" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const editedEmail = data.choices?.[0]?.message?.content?.trim();

    if (!editedEmail) {
      return new Response(
        JSON.stringify({ error: "Keine Antwort vom KI-Service erhalten" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ edited_email: editedEmail }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in edit-email-ai:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unbekannter Fehler" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
