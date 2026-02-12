import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { action, recording_id, email, share_id, user_ids } = await req.json();

    if (action === "list-team-members") {
      // Get user's teams
      const { data: memberships } = await adminClient
        .from("team_members")
        .select("team_id")
        .eq("user_id", userId);

      if (!memberships || memberships.length === 0) {
        return new Response(JSON.stringify({ success: true, members: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const teamIds = memberships.map((m: any) => m.team_id);

      // Get team names
      const { data: teams } = await adminClient
        .from("teams")
        .select("id, name")
        .in("id", teamIds);

      const teamMap = new Map<string, string>();
      (teams || []).forEach((t: any) => teamMap.set(t.id, t.name));

      // Get all members of those teams
      const { data: allMembers } = await adminClient
        .from("team_members")
        .select("user_id, team_id")
        .in("team_id", teamIds)
        .neq("user_id", userId);

      // Resolve emails
      const members = [];
      const seen = new Set<string>();
      for (const m of allMembers || []) {
        const key = `${m.user_id}-${m.team_id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const { data: userData } = await adminClient.auth.admin.getUserById(m.user_id);
        members.push({
          userId: m.user_id,
          email: userData?.user?.email || "Unbekannt",
          teamId: m.team_id,
          teamName: teamMap.get(m.team_id) || "Unbekannt",
        });
      }

      return new Response(JSON.stringify({ success: true, members }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list") {
      // List all shares for a recording
      const { data: shares, error } = await adminClient
        .from("shared_recordings")
        .select("*")
        .eq("recording_id", recording_id)
        .eq("shared_by", userId);

      if (error) throw error;

      // Resolve emails for shared_with users
      const enriched = [];
      for (const share of shares || []) {
        const { data: userData } = await adminClient.auth.admin.getUserById(share.shared_with);
        enriched.push({
          id: share.id,
          shared_with: share.shared_with,
          email: userData?.user?.email || "Unbekannt",
          created_at: share.created_at,
        });
      }

      return new Response(JSON.stringify({ success: true, shares: enriched }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "share") {
      if (!email || !recording_id) {
        return new Response(
          JSON.stringify({ success: false, error: "E-Mail und Recording-ID erforderlich" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify ownership
      const { data: rec } = await adminClient
        .from("recordings")
        .select("user_id")
        .eq("id", recording_id)
        .single();

      if (!rec || rec.user_id !== userId) {
        return new Response(
          JSON.stringify({ success: false, error: "Du kannst nur eigene Meetings teilen" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Find target user by email
      const { data: users, error: listError } = await adminClient.auth.admin.listUsers({
        perPage: 1000,
      });
      if (listError) throw listError;

      const targetUser = users.users.find(
        (u) => u.email?.toLowerCase() === email.toLowerCase()
      );
      if (!targetUser) {
        return new Response(
          JSON.stringify({ success: false, error: "Kein User mit dieser E-Mail gefunden" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (targetUser.id === userId) {
        return new Response(
          JSON.stringify({ success: false, error: "Du kannst ein Meeting nicht mit dir selbst teilen" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Insert share
      const { error: insertError } = await adminClient
        .from("shared_recordings")
        .insert({
          recording_id,
          shared_by: userId,
          shared_with: targetUser.id,
        });

      if (insertError) {
        if (insertError.code === "23505") {
          return new Response(
            JSON.stringify({ success: false, error: "Meeting bereits mit diesem User geteilt" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        throw insertError;
      }

      return new Response(
        JSON.stringify({ success: true, shared_with_email: targetUser.email }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "share-team") {
      if (!recording_id || !Array.isArray(user_ids) || user_ids.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: "recording_id und user_ids erforderlich" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify ownership
      const { data: rec } = await adminClient
        .from("recordings")
        .select("user_id")
        .eq("id", recording_id)
        .single();

      if (!rec || rec.user_id !== userId) {
        return new Response(
          JSON.stringify({ success: false, error: "Du kannst nur eigene Meetings teilen" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Filter out self
      const targetIds = (user_ids as string[]).filter((id: string) => id !== userId);
      
      let shared = 0;
      let skipped = 0;
      for (const targetId of targetIds) {
        const { error: insertError } = await adminClient
          .from("shared_recordings")
          .insert({ recording_id, shared_by: userId, shared_with: targetId });
        if (insertError) {
          if (insertError.code === "23505") { skipped++; continue; }
          console.error("share-team insert error:", insertError);
        } else {
          shared++;
        }
      }

      return new Response(
        JSON.stringify({ success: true, shared, skipped }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "unshare") {
      if (!share_id) {
        return new Response(
          JSON.stringify({ success: false, error: "Share-ID erforderlich" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: deleteError } = await adminClient
        .from("shared_recordings")
        .delete()
        .eq("id", share_id)
        .eq("shared_by", userId);

      if (deleteError) throw deleteError;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: false, error: "Ungültige Aktion" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("share-recording error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Interner Fehler" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
