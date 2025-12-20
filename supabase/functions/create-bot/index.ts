import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Daten vom Frontend holen
    const { meetingUrl, botName, botAvatarUrl } = await req.json();

    if (!meetingUrl) {
      return new Response(
        JSON.stringify({ error: "Meeting URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Supabase Client initialisieren
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 3. Recall API Konfiguration laden
    const recallApiKey = Deno.env.get("RECALL_API_KEY");
    const recallApiUrl = Deno.env.get("RECALL_API_URL") || "https://us-west-2.recall.ai/api/v1/bot";

    if (!recallApiKey) {
      throw new Error("RECALL_API_KEY ist nicht gesetzt");
    }

    console.log(`[Recall] Sende Bot zu: ${meetingUrl}`);
    console.log(`[Recall] Bot Name: ${botName || "Notetaker Bot"}`);
    console.log(`[Recall] Bot Avatar: ${botAvatarUrl || "nicht gesetzt"}`);

    // 4. Bot-Konfiguration erstellen
    const botConfig: Record<string, unknown> = {
      meeting_url: meetingUrl,
      bot_name: botName || "Notetaker Bot",
      join_at: new Date().toISOString(),
      // Speaker Timeline für Sprecher-Identifikation aktivieren
      speaker_timeline: {
        enabled: true
      },
      recording_config: {
        transcript: {
          provider: { 
            recallai_streaming: {
              mode: "prioritize_accuracy",
              language_code: "auto"
            }
          }
        }
      }
    };
    
    // Bot-Profilbild hinzufügen wenn vorhanden
    if (botAvatarUrl) {
      botConfig.bot_image = botAvatarUrl;
    }

    // 5. Bot bei Recall.ai erstellen
    const recallResponse = await fetch(recallApiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Token ${recallApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(botConfig),
    });

    if (!recallResponse.ok) {
      const errorText = await recallResponse.text();
      console.error("[Recall] API Fehler:", errorText);
      throw new Error(`Recall API Fehler: ${recallResponse.status} - ${errorText}`);
    }

    const botData = await recallResponse.json();
    console.log(`[Recall] Bot erstellt. ID: ${botData.id}`);

    // 5. Generiere eine meeting_id (NOT NULL constraint)
    const meetingId = crypto.randomUUID();

    // 6. Bot-Daten in Supabase speichern
    const { data: dbData, error: dbError } = await supabase
      .from("recordings")
      .insert({
        meeting_id: meetingId,
        meeting_url: meetingUrl,
        recall_bot_id: botData.id,
        status: "joining",
      })
      .select()
      .single();

    if (dbError) {
      console.error("[Supabase] DB Fehler:", dbError);
      throw new Error(`Datenbank Fehler: ${dbError.message}`);
    }

    console.log(`[Supabase] Recording erstellt: ${dbData.id}`);

    // 7. Erfolgsmeldung zurück ans Frontend
    return new Response(
      JSON.stringify({
        success: true,
        meetingId: dbData.meeting_id,
        bot_id: botData.id,
        recording: dbData,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[create-bot] Fehler:", error);
    const errorMessage = error instanceof Error ? error.message : "Unbekannter Fehler";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
