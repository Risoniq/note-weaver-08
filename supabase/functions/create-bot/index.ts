import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.208.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Funktion um ein Bild von einer URL zu laden und als Base64 zu konvertieren
async function fetchImageAsBase64(imageUrl: string): Promise<string | null> {
  try {
    console.log(`[Image] Lade Bild von: ${imageUrl}`);
    const response = await fetch(imageUrl);
    
    if (!response.ok) {
      console.error(`[Image] Fehler beim Laden: ${response.status}`);
      return null;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const base64String = base64Encode(uint8Array);
    
    console.log(`[Image] Bild erfolgreich geladen und konvertiert (${base64String.length} chars)`);
    return base64String;
  } catch (error) {
    console.error(`[Image] Fehler beim Konvertieren:`, error);
    return null;
  }
}

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

    const finalBotName = botName || "Notetaker Bot";
    console.log(`[Recall] Sende Bot zu: ${meetingUrl}`);
    console.log(`[Recall] Bot Name: ${finalBotName}`);
    console.log(`[Recall] Bot Avatar URL: ${botAvatarUrl || "nicht gesetzt"}`);

    // 4. Bot-Konfiguration erstellen
    const botConfig: Record<string, unknown> = {
      meeting_url: meetingUrl,
      bot_name: finalBotName,
      join_at: new Date().toISOString(),
      // Speaker Timeline für Sprecher-Identifikation aktivieren
      speaker_timeline: {
        enabled: true
      },
      // Automatisches Verlassen konfigurieren - längere Wartezeit im Wartebereich
      automatic_leave: {
        waiting_room_timeout: 600, // 10 Minuten im Wartebereich warten
        noone_joined_timeout: 300, // 5 Minuten warten wenn niemand beitritt
        everyone_left_timeout: 60  // 1 Minute warten nachdem alle gegangen sind
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
    
    // Bot-Profilbild als Video-Output setzen (funktioniert für Teams, Zoom, Meet)
    if (botAvatarUrl) {
      try {
        const base64Image = await fetchImageAsBase64(botAvatarUrl);
        
        if (base64Image) {
          // automatic_video_output zeigt das Bild als Bot-Video/Profilbild
          botConfig.automatic_video_output = {
            in_call_not_recording: {
              kind: "jpeg",
              b64_data: base64Image
            },
            in_call_recording: {
              kind: "jpeg", 
              b64_data: base64Image
            }
          };
          console.log(`[Recall] Bot Avatar als Video-Output konfiguriert`);
        }
      } catch (imageError) {
        console.error(`[Recall] Konnte Avatar nicht laden:`, imageError);
      }
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
