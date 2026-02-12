import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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

    // Create client with user's token to verify authentication
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsError } = await supabaseUser.auth.getClaims(token);
    
    if (claimsError || !claims?.claims) {
      console.error('Claims error:', claimsError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = claims.claims.sub;

    // Use service role client to check admin status
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user is admin using the has_role function
    const { data: isAdmin, error: roleError } = await supabaseAdmin.rpc('has_role', {
      _user_id: userId,
      _role: 'admin',
    });

    if (roleError) {
      console.error('Role check error:', roleError);
      return new Response(JSON.stringify({ error: 'Failed to check permissions' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden - Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch all users from auth.users
    const { data: authUsers, error: usersError } = await supabaseAdmin.auth.admin.listUsers();

    if (usersError) {
      console.error('Users fetch error:', usersError);
      return new Response(JSON.stringify({ error: 'Failed to fetch users' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch recordings stats per user
    const { data: recordings, error: recordingsError } = await supabaseAdmin
      .from('recordings')
      .select('user_id, duration, word_count, created_at, status');

    if (recordingsError) {
      console.error('Recordings fetch error:', recordingsError);
    }

    // Fetch calendar connections
    const { data: calendarUsers, error: calendarError } = await supabaseAdmin
      .from('recall_calendar_users')
      .select('supabase_user_id, google_connected, microsoft_connected');

    if (calendarError) {
      console.error('Calendar users fetch error:', calendarError);
    }

    // Fetch user presence data
    const { data: presenceData, error: presenceError } = await supabaseAdmin
      .from('user_presence')
      .select('user_id, last_seen, is_online');

    if (presenceError) {
      console.error('Presence fetch error:', presenceError);
    }

    // Fetch user roles (approved status)
    const { data: userRoles, error: rolesError2 } = await supabaseAdmin
      .from('user_roles')
      .select('user_id, role');

    if (rolesError2) {
      console.error('User roles fetch error:', rolesError2);
    }

    // Fetch user quotas
    const { data: quotas, error: quotasError } = await supabaseAdmin
      .from('user_quotas')
      .select('user_id, max_minutes');

    if (quotasError) {
      console.error('Quotas fetch error:', quotasError);
    }

    // Fetch teams
    const { data: teams, error: teamsError } = await supabaseAdmin
      .from('teams')
      .select('id, name, max_minutes, created_at');

    if (teamsError) {
      console.error('Teams fetch error:', teamsError);
    }

    // Fetch team memberships
    const { data: teamMembers, error: teamMembersError } = await supabaseAdmin
      .from('team_members')
      .select('team_id, user_id, role');

    if (teamMembersError) {
      console.error('Team members fetch error:', teamMembersError);
    }

    // Active bot statuses
    const activeBotStatuses = ['joining', 'in_call_not_recording', 'in_call_recording', 'waiting_room'];
    
    // Build user stats - only count "done" recordings for quota calculation
    const recordingsMap = new Map<string, { count: number; duration: number; words: number; lastActivity: string | null; hasActiveBot: boolean }>();
    
    if (recordings) {
      for (const rec of recordings) {
        if (!rec.user_id) continue;
        
        const existing = recordingsMap.get(rec.user_id) || { count: 0, duration: 0, words: 0, lastActivity: null, hasActiveBot: false };
        
        // Only count completed recordings for quota calculation (duration, count, words)
        if (rec.status === 'done') {
          existing.count += 1;
          existing.duration += rec.duration || 0;
          existing.words += rec.word_count || 0;
        }
        
        // Track lastActivity for all recordings
        if (!existing.lastActivity || new Date(rec.created_at) > new Date(existing.lastActivity)) {
          existing.lastActivity = rec.created_at;
        }
        
        // Check if this user has an active bot (independent of done status)
        if (activeBotStatuses.includes(rec.status)) {
          existing.hasActiveBot = true;
        }
        
        recordingsMap.set(rec.user_id, existing);
      }
    }

    const calendarMap = new Map<string, { google: boolean; microsoft: boolean }>();
    if (calendarUsers) {
      for (const cu of calendarUsers) {
        calendarMap.set(cu.supabase_user_id, {
          google: cu.google_connected || false,
          microsoft: cu.microsoft_connected || false,
        });
      }
    }

    const presenceMap = new Map<string, { lastSeen: string; isOnline: boolean }>();
    if (presenceData) {
      for (const p of presenceData) {
        presenceMap.set(p.user_id, {
          lastSeen: p.last_seen,
          isOnline: p.is_online,
        });
      }
    }

    // Build roles map - track if user is approved or admin
    const rolesMap = new Map<string, { isApproved: boolean; isAdmin: boolean }>();
    if (userRoles) {
      for (const ur of userRoles) {
        const existing = rolesMap.get(ur.user_id) || { isApproved: false, isAdmin: false };
        if (ur.role === 'approved') existing.isApproved = true;
        if (ur.role === 'admin') {
          existing.isAdmin = true;
          existing.isApproved = true; // Admins are always considered approved
        }
        rolesMap.set(ur.user_id, existing);
      }
    }

    // Build quotas map
    const quotaMap = new Map<string, number>();
    if (quotas) {
      for (const q of quotas) {
        quotaMap.set(q.user_id, q.max_minutes);
      }
    }

    // Build team membership map (user_id -> array of team memberships)
    const teamMemberMap = new Map<string, { teamId: string; teamName: string; teamRole: string }[]>();
    const teamMemberCounts = new Map<string, number>();
    const teamLeadsMap = new Map<string, string[]>(); // team_id -> lead emails
    if (teamMembers && teams) {
      const teamsById = new Map(teams.map(t => [t.id, t]));
      for (const tm of teamMembers) {
        const team = teamsById.get(tm.team_id);
        if (team) {
          const existing = teamMemberMap.get(tm.user_id) || [];
          existing.push({
            teamId: tm.team_id,
            teamName: team.name,
            teamRole: tm.role,
          });
          teamMemberMap.set(tm.user_id, existing);
          teamMemberCounts.set(tm.team_id, (teamMemberCounts.get(tm.team_id) || 0) + 1);
          
          // Track team leads
          if (tm.role === 'lead') {
            const leadUser = authUsers.users.find(u => u.id === tm.user_id);
            if (leadUser) {
              const leads = teamLeadsMap.get(tm.team_id) || [];
              leads.push(leadUser.email || 'Unknown');
              teamLeadsMap.set(tm.team_id, leads);
            }
          }
        }
      }
    }

    // Calculate team used minutes
    const teamUsedMinutesMap = new Map<string, number>();
    if (teamMembers && recordings) {
      // Group team members by team
      const teamUserIds = new Map<string, string[]>();
      for (const tm of teamMembers) {
        const ids = teamUserIds.get(tm.team_id) || [];
        ids.push(tm.user_id);
        teamUserIds.set(tm.team_id, ids);
      }
      
      // Calculate used minutes per team
      for (const [teamId, userIds] of teamUserIds) {
        const teamRecordings = recordings.filter(r => 
          r.status === 'done' && userIds.includes(r.user_id)
        );
        const usedSeconds = teamRecordings.reduce((sum, r) => sum + (r.duration || 0), 0);
        teamUsedMinutesMap.set(teamId, Math.round(usedSeconds / 60));
      }
    }

    // Determine online status (online if heartbeat within last 60 seconds)
    const ONLINE_TIMEOUT = 60000; // 60 seconds
    const now = Date.now();

    const getUserOnlineStatus = (userId: string): 'online' | 'recording' | 'offline' => {
      const stats = recordingsMap.get(userId);
      const presence = presenceMap.get(userId);

      // Check for active bot first (orange)
      if (stats?.hasActiveBot) {
        return 'recording';
      }

      // Check if online (green)
      if (presence?.isOnline && presence.lastSeen) {
        const lastSeenTime = new Date(presence.lastSeen).getTime();
        if (now - lastSeenTime < ONLINE_TIMEOUT) {
          return 'online';
        }
      }

      return 'offline';
    };

    // Combine all data
    const users = authUsers.users.map((user) => {
      const stats = recordingsMap.get(user.id) || { count: 0, duration: 0, words: 0, lastActivity: null, hasActiveBot: false };
      const calendar = calendarMap.get(user.id) || { google: false, microsoft: false };
      const onlineStatus = getUserOnlineStatus(user.id);
      const roles = rolesMap.get(user.id) || { isApproved: false, isAdmin: false };
      const userTeams = teamMemberMap.get(user.id) || [];
      
      // If user is in team(s), use the highest team quota, otherwise individual
      let maxMinutes: number;
      let usedMinutes: number;
      
      if (userTeams.length > 0) {
        // Use highest team quota across all teams
        let bestMaxMinutes = 0;
        let bestUsedMinutes = 0;
        for (const ut of userTeams) {
          const team = teams?.find(t => t.id === ut.teamId);
          const teamMax = team?.max_minutes ?? 600;
          const teamUsed = teamUsedMinutesMap.get(ut.teamId) ?? 0;
          if (teamMax > bestMaxMinutes) {
            bestMaxMinutes = teamMax;
            bestUsedMinutes = teamUsed;
          }
        }
        maxMinutes = bestMaxMinutes;
        usedMinutes = bestUsedMinutes;
      } else {
        maxMinutes = quotaMap.get(user.id) ?? 120;
        usedMinutes = Math.round(stats.duration / 60);
      }

      return {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        recordings_count: stats.count,
        total_duration: stats.duration,
        total_words: stats.words,
        last_activity: stats.lastActivity,
        google_connected: calendar.google,
        microsoft_connected: calendar.microsoft,
        online_status: onlineStatus,
        is_approved: roles.isApproved,
        is_admin: roles.isAdmin,
        max_minutes: maxMinutes,
        used_minutes: usedMinutes,
        // Multi-team: return teams array
        teams: userTeams.map(ut => ({ id: ut.teamId, name: ut.teamName, role: ut.teamRole })),
        // Backwards compat: first team
        team_id: userTeams[0]?.teamId || null,
        team_name: userTeams[0]?.teamName || null,
        team_role: userTeams[0]?.teamRole || null,
      };
    });

    // Build teams list with stats
    const teamsWithStats = (teams || []).map(team => ({
      id: team.id,
      name: team.name,
      max_minutes: team.max_minutes,
      used_minutes: teamUsedMinutesMap.get(team.id) ?? 0,
      member_count: teamMemberCounts.get(team.id) ?? 0,
      created_at: team.created_at,
      leads: teamLeadsMap.get(team.id) || [],
    }));

    // Calculate summary stats
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    
    const onlineNow = users.filter((u) => u.online_status === 'online').length;
    const recordingNow = users.filter((u) => u.online_status === 'recording').length;
    
    // Only count completed recordings for total minutes (duration is in seconds)
    const completedRecordings = recordings?.filter((r) => r.status === 'done') || [];
    const totalDurationSeconds = completedRecordings.reduce((sum, r) => sum + (r.duration || 0), 0);
    
    const summary = {
      total_users: users.length,
      active_users: users.filter((u) => u.last_activity && new Date(u.last_activity) > sevenDaysAgo).length,
      total_recordings: completedRecordings.length,
      total_minutes: Math.round(totalDurationSeconds / 60), // Convert seconds to minutes
      online_now: onlineNow,
      recording_now: recordingNow,
    };

    return new Response(JSON.stringify({ users, teams: teamsWithStats, summary }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
