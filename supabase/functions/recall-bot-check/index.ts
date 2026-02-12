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

    // Verify user is admin
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

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Nur Admins" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { bot_id } = await req.json();
    if (!bot_id) {
      return new Response(JSON.stringify({ error: "bot_id erforderlich" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Get bot data from Recall.ai
    const botResponse = await fetch(
      `https://eu-central-1.recall.ai/api/v1/bot/${bot_id}/`,
      { headers: { Authorization: `Token ${recallApiKey}` } }
    );

    let botData = null;
    let botError = null;
    if (botResponse.ok) {
      botData = await botResponse.json();
    } else {
      botError = { status: botResponse.status, body: await botResponse.text() };
    }

    // 2. Check calendar meetings for this bot
    let calendarData = null;
    let calendarError = null;
    try {
      const calResponse = await fetch(
        `https://eu-central-1.recall.ai/api/v1/calendar/meetings/?bot_id=${bot_id}`,
        { headers: { Authorization: `Token ${recallApiKey}` } }
      );
      if (calResponse.ok) {
        calendarData = await calResponse.json();
      } else {
        calendarError = { status: calResponse.status, body: await calResponse.text() };
      }
    } catch (e) {
      calendarError = { message: e instanceof Error ? e.message : "Unknown error" };
    }

    // 3. Check DB for this bot
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: dbRecording } = await supabase
      .from("recordings")
      .select("id, title, status, video_url, transcript_text, created_at, user_id")
      .eq("recall_bot_id", bot_id)
      .maybeSingle();

    return new Response(
      JSON.stringify({
        bot_id,
        recall_bot: botData,
        recall_bot_error: botError,
        calendar_meeting: calendarData,
        calendar_error: calendarError,
        db_recording: dbRecording,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("recall-bot-check error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unbekannter Fehler" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
