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

    const body = await req.json();
    const { action, bot_id, date_from, date_to, user_email } = body;

    // --- NEW: list-bots action ---
    if (action === "list-bots") {
      const allBots: any[] = [];
      let nextUrl: string | null = null;

      // Build initial URL
      const initialUrl = new URL("https://eu-central-1.recall.ai/api/v1/bot/");
      if (date_from) initialUrl.searchParams.append("created_after", date_from);
      if (date_to) initialUrl.searchParams.append("created_before", date_to);
      initialUrl.searchParams.append("ordering", "-created_at");

      nextUrl = initialUrl.toString();

      // Paginate through all results
      while (nextUrl) {
        const res = await fetch(nextUrl, {
          headers: { Authorization: `Token ${recallApiKey}` },
        });
        if (!res.ok) {
          const errText = await res.text();
          return new Response(
            JSON.stringify({ error: "Recall API error", status: res.status, details: errText }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const data = await res.json();
        if (data.results) allBots.push(...data.results);
        nextUrl = data.next || null;
      }

      // Optional: filter by user_email -> find recall_user_id
      let filteredBots = allBots;
      let resolvedUserId: string | null = null;

      if (user_email) {
        // Look up supabase user by email
        const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
        const targetUser = authUsers?.users?.find((u: any) => u.email === user_email);

        if (targetUser) {
          resolvedUserId = targetUser.id;
          // Get recall_user_id from recall_calendar_users
          const { data: calUser } = await supabaseAdmin
            .from("recall_calendar_users")
            .select("recall_user_id")
            .eq("supabase_user_id", targetUser.id)
            .maybeSingle();

          if (calUser?.recall_user_id) {
            // Filter bots by metadata or meeting_participants matching this user
            filteredBots = allBots.filter((bot: any) => {
              const meta = bot.metadata || {};
              if (meta.user_id === targetUser.id) return true;
              if (meta.supabase_user_id === targetUser.id) return true;
              // Check calendar_user in metadata
              if (meta.calendar_user_id === calUser.recall_user_id) return true;
              return false;
            });
          }
        }
      }

      // Cross-reference with DB
      const botIds = filteredBots.map((b: any) => b.id);
      let existingBotIds: Set<string> = new Set();

      if (botIds.length > 0) {
        const { data: existingRecs } = await supabaseAdmin
          .from("recordings")
          .select("recall_bot_id")
          .in("recall_bot_id", botIds);
        if (existingRecs) {
          existingBotIds = new Set(existingRecs.map((r: any) => r.recall_bot_id));
        }
      }

      const result = filteredBots.map((bot: any) => ({
        id: bot.id,
        status: bot.status_changes?.[bot.status_changes.length - 1]?.code || "unknown",
        meeting_url: bot.meeting_url,
        created_at: bot.created_at,
        metadata: bot.metadata,
        has_db_entry: existingBotIds.has(bot.id),
        video_url: bot.video_url || null,
        status_changes: bot.status_changes,
      }));

      return new Response(
        JSON.stringify({
          action: "list-bots",
          total_from_recall: allBots.length,
          filtered_count: filteredBots.length,
          resolved_user_id: resolvedUserId,
          user_email: user_email || null,
          bots: result,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- EXISTING: single bot check ---
    if (!bot_id) {
      return new Response(JSON.stringify({ error: "bot_id oder action erforderlich" }), {
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
    const { data: dbRecording } = await supabaseAdmin
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
