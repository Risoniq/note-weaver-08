import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
      .select('user_id, duration, word_count, created_at');

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

    // Build user stats
    const recordingsMap = new Map<string, { count: number; duration: number; words: number; lastActivity: string | null }>();
    
    if (recordings) {
      for (const rec of recordings) {
        if (!rec.user_id) continue;
        
        const existing = recordingsMap.get(rec.user_id) || { count: 0, duration: 0, words: 0, lastActivity: null };
        existing.count += 1;
        existing.duration += rec.duration || 0;
        existing.words += rec.word_count || 0;
        
        if (!existing.lastActivity || new Date(rec.created_at) > new Date(existing.lastActivity)) {
          existing.lastActivity = rec.created_at;
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

    // Combine all data
    const users = authUsers.users.map((user) => {
      const stats = recordingsMap.get(user.id) || { count: 0, duration: 0, words: 0, lastActivity: null };
      const calendar = calendarMap.get(user.id) || { google: false, microsoft: false };

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
      };
    });

    // Calculate summary stats
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const summary = {
      total_users: users.length,
      active_users: users.filter((u) => u.last_activity && new Date(u.last_activity) > sevenDaysAgo).length,
      total_recordings: recordings?.length || 0,
      total_minutes: Math.round((recordings?.reduce((sum, r) => sum + (r.duration || 0), 0) || 0) / 60),
    };

    return new Response(JSON.stringify({ users, summary }), {
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
