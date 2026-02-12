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

    // Verify user authentication
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

    // Check if user is a team lead
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('team_members')
      .select('team_id, role, teams(id, name, max_minutes)')
      .eq('user_id', user.id)
      .eq('role', 'lead')
      .maybeSingle();

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

    if (!membership && !isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden - Teamlead or Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let memberUserIds: string[] = [];
    let teamMembersData: any[] = [];

    if (isAdmin && !membership) {
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

      // Collect unique user IDs from recordings
      const uniqueUserIds = [...new Set((allRecordings || []).map(r => r.user_id).filter(Boolean))];

      // Resolve all user emails
      const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
      const userEmailMap = new Map<string, string>();
      if (authUsers?.users) {
        for (const u of authUsers.users) {
          userEmailMap.set(u.id, u.email || 'Unknown');
        }
      }

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

    // Teamlead path: existing logic
    const { data: teamMembers, error: teamMembersError } = await supabaseAdmin
      .from('team_members')
      .select('user_id, role')
      .eq('team_id', membership.team_id);

    if (teamMembersError) {
      console.error('Team members fetch error:', teamMembersError);
      return new Response(JSON.stringify({ error: 'Failed to fetch team members' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    memberUserIds = teamMembers?.map(m => m.user_id) || [];

    // Get user emails for display
    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
    const userEmailMap = new Map<string, string>();
    if (authUsers?.users) {
      for (const u of authUsers.users) {
        if (memberUserIds.includes(u.id)) {
          userEmailMap.set(u.id, u.email || 'Unknown');
        }
      }
    }

    // Build team members list with emails
    const membersWithInfo = teamMembers?.map(m => ({
      user_id: m.user_id,
      role: m.role,
      email: userEmailMap.get(m.user_id) || 'Unknown',
    })) || [];

    return new Response(JSON.stringify({
      team: membership.teams,
      members: membersWithInfo,
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
