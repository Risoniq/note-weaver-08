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
    const { meetingUrl } = await req.json();

    if (!meetingUrl) {
      return new Response(
        JSON.stringify({ error: "Meeting URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Creating bot for meeting:", meetingUrl);

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate a unique meeting ID
    const meetingId = crypto.randomUUID();

    // Create recording entry in database
    const { data, error } = await supabase
      .from("recordings")
      .insert({
        meeting_id: meetingId,
        meeting_url: meetingUrl,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      console.error("Database error:", error);
      throw error;
    }

    console.log("Recording entry created:", data);

    // Here you would integrate with your actual meeting bot service
    // For example: Recall.ai, Skribby, or your external bot service
    const botServiceUrl = Deno.env.get("BOT_SERVICE_URL");
    const botServiceSecret = Deno.env.get("BOT_SERVICE_SECRET");

    if (botServiceUrl && botServiceSecret) {
      // Forward to external bot service
      try {
        const botResponse = await fetch(botServiceUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-secret-key": botServiceSecret,
          },
          body: JSON.stringify({
            meeting_id: meetingId,
            meeting_url: meetingUrl,
          }),
        });

        if (!botResponse.ok) {
          console.error("Bot service error:", await botResponse.text());
        } else {
          console.log("Bot service notified successfully");
          
          // Update status to indicate bot is joining
          await supabase
            .from("recordings")
            .update({ status: "joining" })
            .eq("meeting_id", meetingId);
        }
      } catch (botError) {
        console.error("Failed to notify bot service:", botError);
      }
    } else {
      console.log("No bot service configured, simulating bot join...");
      
      // Simulate bot joining (for demo purposes)
      await supabase
        .from("recordings")
        .update({ status: "recording" })
        .eq("meeting_id", meetingId);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        meetingId,
        message: "Bot is being sent to the meeting" 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in create-bot:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to create bot";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
