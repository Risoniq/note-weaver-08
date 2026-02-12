import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Optional: filter by specific team_id
    let requestedTeamId: string | null = null;
    try {
      const url = new URL(req.url);
      requestedTeamId = url.searchParams.get('team_id');
    } catch {}

    // Check if user is a team lead (can be in multiple teams)
    const { data: memberships, error: membershipError } = await supabaseAdmin
      .from('team_members')
      .select('team_id, role, teams(id, name, max_minutes)')
      .eq('user_id', user.id)
      .eq('role', 'lead');

    if (membershipError) {
      console.error('Membership check error:', membershipError);
      return new Response(JSON.stringify({ error: 'Failed to check team membership' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is admin
    const { data: isAdmin } = await supabaseAdmin.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin',
    });

    if ((!memberships || memberships.length === 0) && !isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden - Teamlead or Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get all auth users for email resolution
    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
    const userEmailMap = new Map<string, string>();
    if (authUsers?.users) {
      for (const u of authUsers.users) {
        userEmailMap.set(u.id, u.email || 'Unknown');
      }
    }

    if (isAdmin && (!memberships || memberships.length === 0)) {
      // Admin path: fetch ALL recordings from all users
      const { data: allRecordings, error: allRecError } = await supabaseAdmin
        .from('recordings')
        .select('*')
        .order('created_at', { ascending: false });

      if (allRecError) {
        console.error('Admin recordings fetch error:', allRecError);
        return new Response(JSON.stringify({ error: 'Failed to fetch recordings' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const uniqueUserIds = [...new Set((allRecordings || []).map(r => r.user_id).filter(Boolean))];

      const recordingsWithOwner = (allRecordings || []).map(rec => ({
        ...rec,
        owner_email: userEmailMap.get(rec.user_id) || 'Unknown',
        is_own: rec.user_id === user.id,
      }));

      const membersWithInfo = uniqueUserIds.map(uid => ({
        user_id: uid,
        role: 'member',
        email: userEmailMap.get(uid) || 'Unknown',
      }));

      return new Response(JSON.stringify({
        team: { name: 'Alle Accounts' },
        members: membersWithInfo,
        recordings: recordingsWithOwner,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Teamlead path: collect members from all lead teams (or specific team)
    const leadTeamIds = memberships!.map(m => m.team_id);
    const targetTeamIds = requestedTeamId && leadTeamIds.includes(requestedTeamId)
      ? [requestedTeamId]
      : leadTeamIds;

    // Fetch all team members from target teams
    const { data: teamMembers, error: teamMembersError } = await supabaseAdmin
      .from('team_members')
      .select('user_id, role, team_id')
      .in('team_id', targetTeamIds);

    if (teamMembersError) {
      console.error('Team members fetch error:', teamMembersError);
      return new Response(JSON.stringify({ error: 'Failed to fetch team members' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Deduplicate member user IDs across teams
    const memberUserIds = [...new Set(teamMembers?.map(m => m.user_id) || [])];

    const membersWithInfo = teamMembers?.map(m => ({
      user_id: m.user_id,
      role: m.role,
      team_id: m.team_id,
      email: userEmailMap.get(m.user_id) || 'Unknown',
    })) || [];

    // Deduplicate members for the response
    const uniqueMembers = Array.from(
      new Map(membersWithInfo.map(m => [m.user_id, m])).values()
    );

    // Fetch recordings for all team member user IDs
    const { data: teamRecordings, error: recError } = await supabaseAdmin
      .from('recordings')
      .select('*')
      .in('user_id', memberUserIds)
      .order('created_at', { ascending: false });

    if (recError) {
      console.error('Recordings fetch error:', recError);
      return new Response(JSON.stringify({ error: 'Failed to fetch recordings' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const recordingsWithOwner = (teamRecordings || []).map(rec => ({
      ...rec,
      owner_email: userEmailMap.get(rec.user_id) || 'Unknown',
      is_own: rec.user_id === user.id,
    }));

    // Return first team info or combined
    const teamInfo = targetTeamIds.length === 1
      ? memberships!.find(m => m.team_id === targetTeamIds[0])?.teams
      : { name: 'Alle Teams' };

    return new Response(JSON.stringify({
      team: teamInfo,
      members: uniqueMembers,
      recordings: recordingsWithOwner,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Teamlead recordings error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
