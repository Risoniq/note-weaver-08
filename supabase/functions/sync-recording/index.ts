import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    console.log("Syncing recording status for meeting:", meetingId);

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get current recording status from database
    const { data: recording, error } = await supabase
      .from("recordings")
      .select("*")
      .eq("meeting_id", meetingId)
      .maybeSingle();

    if (error) {
      console.error("Database error:", error);
      throw error;
    }

    if (!recording) {
      return new Response(
        JSON.stringify({ error: "Recording not found", status: "not_found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Current recording status:", recording.status);

    // Here you would sync with your actual meeting bot service
    // to get the real status and any available recordings
    const botServiceUrl = Deno.env.get("BOT_SERVICE_URL");
    const botServiceSecret = Deno.env.get("BOT_SERVICE_SECRET");

    if (botServiceUrl && botServiceSecret) {
      // Query external bot service for status
      try {
        const statusResponse = await fetch(`${botServiceUrl}/status?meeting_id=${meetingId}`, {
          method: "GET",
          headers: {
            "x-secret-key": botServiceSecret,
          },
        });

        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          
          // Update recording with data from bot service
          if (statusData.status && statusData.status !== recording.status) {
            const updateData: any = { status: statusData.status };
            
            if (statusData.video_url) updateData.video_url = statusData.video_url;
            if (statusData.transcript_url) updateData.transcript_url = statusData.transcript_url;
            if (statusData.transcript_text) updateData.transcript_text = statusData.transcript_text;

            await supabase
              .from("recordings")
              .update(updateData)
              .eq("meeting_id", meetingId);

            return new Response(
              JSON.stringify({ 
                status: statusData.status,
                ...updateData 
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      } catch (botError) {
        console.error("Failed to sync with bot service:", botError);
      }
    } else {
      // Demo mode: Simulate status progression
      console.log("No bot service configured, using demo mode");
      
      const createdAt = new Date(recording.created_at).getTime();
      const now = Date.now();
      const elapsed = now - createdAt;

      let newStatus = recording.status;
      
      // Simulate progression: pending -> recording -> processing -> done
      if (elapsed > 30000 && recording.status === "processing") {
        newStatus = "done";
        await supabase
          .from("recordings")
          .update({ 
            status: "done",
            video_url: "https://example.com/demo-video.mp4",
            transcript_text: "Dies ist ein Demo-Transkript.\n\nSprecher 1: Willkommen zum Meeting.\nSprecher 2: Danke für die Einladung.\nSprecher 1: Lassen Sie uns mit der Agenda beginnen..."
          })
          .eq("meeting_id", meetingId);
      } else if (elapsed > 15000 && recording.status === "recording") {
        newStatus = "processing";
        await supabase
          .from("recordings")
          .update({ status: "processing" })
          .eq("meeting_id", meetingId);
      } else if (elapsed > 5000 && recording.status === "pending") {
        newStatus = "recording";
        await supabase
          .from("recordings")
          .update({ status: "recording" })
          .eq("meeting_id", meetingId);
      }

      return new Response(
        JSON.stringify({ status: newStatus }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ status: recording.status }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in sync-recording:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to sync recording";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
