import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Recall.ai Status zu internem Status mappen
const statusMap: Record<string, string> = {
  "ready": "pending",
  "joining_call": "joining",
  "in_waiting_room": "joining",
  "in_call_not_recording": "joining",
  "in_call_recording": "recording",
  "recording_permission_allowed": "recording",
  "recording_permission_denied": "error",
  "call_ended": "processing",
  "recording_done": "processing",
  "media_expired": "error",
  "analysis_done": "processing",
  "done": "done",
  "fatal": "error",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { meetingId } = await req.json();

    if (!meetingId) {
      return new Response(
        JSON.stringify({ error: "Meeting ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[sync-recording] Syncing status for meeting:", meetingId);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get recording from database
    const { data: recording, error: dbError } = await supabase
      .from("recordings")
      .select("*")
      .eq("meeting_id", meetingId)
      .maybeSingle();

    if (dbError) {
      console.error("[sync-recording] DB error:", dbError);
      throw dbError;
    }

    if (!recording) {
      return new Response(
        JSON.stringify({ error: "Recording not found", status: "not_found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[sync-recording] Current status:", recording.status, "recall_bot_id:", recording.recall_bot_id);

    // If already done, just return current status
    if (recording.status === "done") {
      return new Response(
        JSON.stringify({ 
          status: "done",
          video_url: recording.video_url,
          transcript_text: recording.transcript_text
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check Recall.ai API key
    const recallApiKey = Deno.env.get("RECALL_API_KEY");
    
    if (!recallApiKey || !recording.recall_bot_id) {
      console.log("[sync-recording] No Recall API key or bot ID, returning current status");
      return new Response(
        JSON.stringify({ status: recording.status }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch bot status from Recall.ai
    const recallApiUrl = Deno.env.get("RECALL_API_URL") || "https://us-west-2.recall.ai/api/v1/bot";
    const botStatusUrl = `${recallApiUrl}/${recording.recall_bot_id}/`;
    
    console.log("[sync-recording] Fetching Recall.ai status:", botStatusUrl);
    
    const recallResponse = await fetch(botStatusUrl, {
      method: "GET",
      headers: {
        "Authorization": `Token ${recallApiKey}`,
      },
    });

    if (!recallResponse.ok) {
      const errorText = await recallResponse.text();
      console.error("[sync-recording] Recall API error:", errorText);
      return new Response(
        JSON.stringify({ status: recording.status, error: "Failed to fetch Recall status" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const botData = await recallResponse.json();
    console.log("[sync-recording] Recall.ai bot status:", botData.status_changes);

    // Get latest status from status_changes array
    const latestRecallStatus = botData.status_changes?.[botData.status_changes.length - 1]?.code || "ready";
    const mappedStatus = statusMap[latestRecallStatus] || recording.status;
    
    console.log("[sync-recording] Latest Recall status:", latestRecallStatus, "-> Mapped:", mappedStatus);

    // Prepare update data
    const updateData: Record<string, unknown> = {};
    
    if (mappedStatus !== recording.status) {
      updateData.status = mappedStatus;
    }

    // If done or processing, try to get video and transcript
    if (mappedStatus === "done" || latestRecallStatus === "done" || latestRecallStatus === "analysis_done") {
      // Get video URL from recording
      if (botData.video_url) {
        updateData.video_url = botData.video_url;
        console.log("[sync-recording] Video URL found:", botData.video_url);
      }

      // Fetch transcript
      try {
        const transcriptUrl = `${recallApiUrl}/${recording.recall_bot_id}/transcript/`;
        const transcriptResponse = await fetch(transcriptUrl, {
          method: "GET",
          headers: {
            "Authorization": `Token ${recallApiKey}`,
          },
        });

        if (transcriptResponse.ok) {
          const transcriptData = await transcriptResponse.json();
          
          // Format transcript as readable text
          if (Array.isArray(transcriptData) && transcriptData.length > 0) {
            const formattedTranscript = transcriptData
              .map((segment: { speaker: string; words: { text: string }[] }) => {
                const speakerName = segment.speaker || "Unbekannt";
                const text = segment.words?.map((w) => w.text).join(" ") || "";
                return `${speakerName}: ${text}`;
              })
              .join("\n\n");
            
            updateData.transcript_text = formattedTranscript;
            updateData.status = "done";
            console.log("[sync-recording] Transcript fetched, length:", formattedTranscript.length);
          }
        } else {
          console.log("[sync-recording] Transcript not ready yet");
        }
      } catch (transcriptError) {
        console.error("[sync-recording] Error fetching transcript:", transcriptError);
      }
    }

    // Update database if there are changes
    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from("recordings")
        .update(updateData)
        .eq("meeting_id", meetingId);

      if (updateError) {
        console.error("[sync-recording] Update error:", updateError);
      } else {
        console.log("[sync-recording] Database updated:", updateData);
      }
    }

    return new Response(
      JSON.stringify({ 
        status: updateData.status || mappedStatus,
        video_url: updateData.video_url,
        transcript_text: updateData.transcript_text,
        recall_status: latestRecallStatus
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[sync-recording] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to sync recording";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
