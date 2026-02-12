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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const body = await req.json();
    const { action, projectId, email, memberId, userId: bodyUserId } = body;

    // ── LIST TEAM MEMBERS ──
    if (action === "list-team-members") {
      if (!projectId) throw new Error("projectId required");

      // Get caller's teams
      const { data: myTeamRows } = await supabaseAdmin
        .from("team_members")
        .select("team_id")
        .eq("user_id", user.id);
      const teamIds = (myTeamRows ?? []).map((t: any) => t.team_id);

      if (teamIds.length === 0) {
        return new Response(JSON.stringify({ members: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get team names
      const { data: teams } = await supabaseAdmin
        .from("teams")
        .select("id, name")
        .in("id", teamIds);
      const teamMap = new Map((teams ?? []).map((t: any) => [t.id, t.name]));

      // Get all members of those teams (excluding caller)
      const { data: allMembers } = await supabaseAdmin
        .from("team_members")
        .select("user_id, team_id")
        .in("team_id", teamIds)
        .neq("user_id", user.id);

      // Deduplicate user_ids
      const uniqueUserIds = [...new Set((allMembers ?? []).map((m: any) => m.user_id))];
      if (uniqueUserIds.length === 0) {
        return new Response(JSON.stringify({ members: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Resolve emails
      const { data: { users: allUsers } } = await supabaseAdmin.auth.admin.listUsers();
      const userEmailMap = new Map((allUsers ?? []).map((u: any) => [u.id, u.email]));

      // Get existing project members to mark already-invited
      const { data: existingMembers } = await supabaseAdmin
        .from("project_members")
        .select("user_id")
        .eq("project_id", projectId);
      const existingSet = new Set((existingMembers ?? []).map((m: any) => m.user_id));

      const result = (allMembers ?? []).map((m: any) => ({
        userId: m.user_id,
        email: userEmailMap.get(m.user_id) ?? "Unknown",
        teamId: m.team_id,
        teamName: teamMap.get(m.team_id) ?? "Unknown",
        alreadyInvited: existingSet.has(m.user_id),
      }));

      return new Response(JSON.stringify({ members: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── INVITE BY USER ID ──
    if (action === "invite-by-user-id") {
      const userId = bodyUserId;
      if (!projectId || !userId) throw new Error("projectId and userId required");

      // Verify caller is project owner
      const { data: proj, error: pErr2 } = await supabaseAdmin
        .from("projects")
        .select("user_id")
        .eq("id", projectId)
        .single();
      if (pErr2 || !proj) throw new Error("Project not found");
      if (proj.user_id !== user.id) throw new Error("Only the project owner can invite");

      if (userId === user.id) throw new Error("Cannot invite yourself");

      // Check same team
      const { data: myT } = await supabaseAdmin.from("team_members").select("team_id").eq("user_id", user.id);
      const { data: targetT } = await supabaseAdmin.from("team_members").select("team_id").eq("user_id", userId);
      const myIds = new Set((myT ?? []).map((t: any) => t.team_id));
      const inSameTeam = (targetT ?? []).some((t: any) => myIds.has(t.team_id));
      if (!inSameTeam) throw new Error("User is not in the same team");

      const { error: insErr } = await supabaseAdmin
        .from("project_members")
        .insert({ project_id: projectId, user_id: userId, invited_by: user.id, status: "pending" });
      if (insErr) {
        if (insErr.code === "23505") throw new Error("User already invited");
        throw new Error(insErr.message);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "invite") {
      if (!projectId || !email) throw new Error("projectId and email required");

      // Verify caller is project owner
      const { data: project, error: pErr } = await supabaseAdmin
        .from("projects")
        .select("user_id")
        .eq("id", projectId)
        .single();
      if (pErr || !project) throw new Error("Project not found");
      if (project.user_id !== user.id) throw new Error("Only the project owner can invite");

      // Find target user by email
      const { data: { users: targetUsers }, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
      if (listErr) throw new Error("Could not look up user");
      const targetUser = targetUsers?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
      if (!targetUser) throw new Error("User not found");
      if (targetUser.id === user.id) throw new Error("Cannot invite yourself");

      // Check same team
      const { data: myTeams } = await supabaseAdmin
        .from("team_members")
        .select("team_id")
        .eq("user_id", user.id);
      const { data: targetTeams } = await supabaseAdmin
        .from("team_members")
        .select("team_id")
        .eq("user_id", targetUser.id);
      const myTeamIds = new Set((myTeams ?? []).map((t: any) => t.team_id));
      const sameTeam = (targetTeams ?? []).some((t: any) => myTeamIds.has(t.team_id));
      if (!sameTeam) throw new Error("User is not in the same team");

      // Insert membership
      const { error: insErr } = await supabaseAdmin
        .from("project_members")
        .insert({ project_id: projectId, user_id: targetUser.id, invited_by: user.id, status: "pending" });
      if (insErr) {
        if (insErr.code === "23505") throw new Error("User already invited");
        throw new Error(insErr.message);
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "list") {
      if (!projectId) throw new Error("projectId required");
      const { data: members, error: mErr } = await supabaseAdmin
        .from("project_members")
        .select("id, user_id, status, created_at, invited_by")
        .eq("project_id", projectId);
      if (mErr) throw new Error(mErr.message);

      // Get emails
      const { data: { users: allUsers } } = await supabaseAdmin.auth.admin.listUsers();
      const userMap = new Map((allUsers ?? []).map((u: any) => [u.id, u.email]));

      const result = (members ?? []).map((m: any) => ({
        ...m,
        email: userMap.get(m.user_id) ?? "Unknown",
      }));

      return new Response(JSON.stringify({ members: result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "remove") {
      if (!memberId) throw new Error("memberId required");

      // Get the membership
      const { data: mem, error: memErr } = await supabaseAdmin
        .from("project_members")
        .select("project_id, user_id")
        .eq("id", memberId)
        .single();
      if (memErr || !mem) throw new Error("Membership not found");

      // Verify caller is project owner
      const { data: project } = await supabaseAdmin
        .from("projects")
        .select("user_id")
        .eq("id", mem.project_id)
        .single();
      if (project?.user_id !== user.id) throw new Error("Only the project owner can remove members");

      const { error: delErr } = await supabaseAdmin
        .from("project_members")
        .delete()
        .eq("id", memberId);
      if (delErr) throw new Error(delErr.message);

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    throw new Error("Unknown action");
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
