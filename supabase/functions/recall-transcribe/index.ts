import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Nicht authentifiziert" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const recallApiKey = Deno.env.get("RECALL_API_KEY")!;

    if (!recallApiKey) {
      return new Response(JSON.stringify({ error: "RECALL_API_KEY nicht konfiguriert" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Nicht authentifiziert" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { recording_id } = await req.json();
    if (!recording_id) {
      return new Response(JSON.stringify({ error: "recording_id erforderlich" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch recording from DB
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: recording, error: dbError } = await supabase
      .from("recordings")
      .select("*")
      .eq("id", recording_id)
      .single();

    if (dbError || !recording) {
      return new Response(JSON.stringify({ error: "Recording nicht gefunden" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify ownership or admin
    if (recording.user_id !== user.id) {
      const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Keine Berechtigung" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!recording.recall_bot_id) {
      return new Response(JSON.stringify({ error: "Kein Recall Bot für dieses Recording" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: Get bot data from Recall.ai to find the recording ID
    console.log(`Fetching bot data for bot_id: ${recording.recall_bot_id}`);
    const botResponse = await fetch(
      `https://eu-central-1.recall.ai/api/v1/bot/${recording.recall_bot_id}/`,
      {
        headers: { Authorization: `Token ${recallApiKey}` },
      }
    );

    if (!botResponse.ok) {
      const errText = await botResponse.text();
      console.error("Recall bot fetch error:", botResponse.status, errText);
      return new Response(JSON.stringify({ error: "Recall Bot-Daten konnten nicht abgerufen werden" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const botData = await botResponse.json();
    console.log("Bot data recordings:", JSON.stringify(botData.recordings));

    if (!botData.recordings || botData.recordings.length === 0) {
      return new Response(JSON.stringify({ error: "Keine Aufnahmen beim Recall Bot gefunden" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const recallRecordingId = botData.recordings[0].id;
    console.log(`Recall Recording ID: ${recallRecordingId}`);

    // Step 2: Create transcript via Recall.ai Async Transcription API
    console.log(`Creating async transcript for recording: ${recallRecordingId}`);
    const transcriptResponse = await fetch(
      `https://eu-central-1.recall.ai/api/v1/recording/${recallRecordingId}/create_transcript/`,
      {
        method: "POST",
        headers: {
          Authorization: `Token ${recallApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: {
            recallai_async: {
              language_code: "deu",
            },
          },
        }),
      }
    );

    if (!transcriptResponse.ok) {
      const errText = await transcriptResponse.text();
      console.error("Recall transcript creation error:", transcriptResponse.status, errText);
      return new Response(
        JSON.stringify({ error: `Transkript-Erstellung fehlgeschlagen: ${transcriptResponse.status}`, details: errText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const transcriptResult = await transcriptResponse.json();
    console.log("Transcript creation result:", JSON.stringify(transcriptResult));

    // Step 3: Update recording status to 'transcribing'
    await supabase
      .from("recordings")
      .update({ status: "transcribing" })
      .eq("id", recording_id);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Recall.ai Transkription gestartet. Bitte in 1-2 Minuten 'Transkript neu laden' klicken.",
        recall_recording_id: recallRecordingId,
        transcript_result: transcriptResult,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("recall-transcribe error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unbekannter Fehler" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
