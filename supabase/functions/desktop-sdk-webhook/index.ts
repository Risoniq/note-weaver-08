import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RECALL_API_KEY = Deno.env.get("RECALL_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("[desktop-sdk-webhook] Received webhook:", JSON.stringify(body));

    const { event, data } = body;

    // Handle SDK upload complete event
    // See: https://docs.recall.ai/docs/desktop-sdk#webhooks
    if (event === "sdk_upload.complete") {
      console.log("[desktop-sdk-webhook] Processing sdk_upload.complete for recording:", data.recording_id);

      // Fetch recording details from Recall.ai API
      const recordingResponse = await fetch(
        `https://eu-central-1.recall.ai/api/v1/recording/${data.recording_id}`,
        {
          headers: {
            Authorization: `Token ${RECALL_API_KEY}`,
          },
        }
      );

      if (!recordingResponse.ok) {
        const errorText = await recordingResponse.text();
        console.error("[desktop-sdk-webhook] Failed to fetch recording:", errorText);
        return new Response(
          JSON.stringify({ error: "Failed to fetch recording details" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const recording = await recordingResponse.json();
      console.log("[desktop-sdk-webhook] Recording data:", JSON.stringify(recording).substring(0, 500));

      // Extract media URLs
      const videoUrl = recording.media_shortcuts?.video_mixed?.data?.download_url ||
                       recording.outputs?.video?.data?.download_url ||
                       null;
      const audioUrl = recording.media_shortcuts?.audio_mixed?.data?.download_url ||
                       recording.outputs?.audio?.data?.download_url ||
                       null;

      // Get user from SDK metadata if available
      const userId = data.user_id || data.metadata?.user_id || null;

      // Create Supabase client with service role
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // Insert or update recording in database
      const { error: dbError } = await supabase
        .from("recordings")
        .upsert({
          recall_id: data.recording_id,
          source: "desktop_sdk",
          status: "done",
          video_url: videoUrl,
          audio_url: audioUrl,
          title: recording.title || `Desktop-Aufnahme ${new Date().toLocaleDateString("de-DE")}`,
          duration: recording.duration || null,
          created_at: new Date().toISOString(),
          user_id: userId,
          // Store full metadata for debugging
          meeting_participants: recording.participants || null,
        }, {
          onConflict: "recall_id",
        });

      if (dbError) {
        console.error("[desktop-sdk-webhook] Database error:", dbError);
        return new Response(
          JSON.stringify({ error: "Failed to save recording" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("[desktop-sdk-webhook] Successfully saved desktop recording:", data.recording_id);

      return new Response(
        JSON.stringify({ success: true, recording_id: data.recording_id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle other SDK events
    if (event === "sdk_upload.started") {
      console.log("[desktop-sdk-webhook] SDK upload started:", data.recording_id);
      return new Response(
        JSON.stringify({ success: true, message: "Upload started acknowledged" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (event === "sdk_upload.failed") {
      console.error("[desktop-sdk-webhook] SDK upload failed:", data);
      return new Response(
        JSON.stringify({ success: true, message: "Upload failure acknowledged" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Unknown event type
    console.log("[desktop-sdk-webhook] Unknown event type:", event);
    return new Response(
      JSON.stringify({ success: true, message: "Event received" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[desktop-sdk-webhook] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});