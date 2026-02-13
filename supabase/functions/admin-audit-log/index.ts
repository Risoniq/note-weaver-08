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
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claims?.claims) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = claims.claims.sub;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: isAdmin } = await supabaseAdmin.rpc('has_role', { _user_id: userId, _role: 'admin' });
    if (!isAdmin) {
      return new Response(JSON.stringify({ success: false, error: 'Forbidden' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { action } = body;

    if (action === 'list') {
      const { limit = 100, offset = 0, event_type, severity, from_date, to_date } = body;

      let query = supabaseAdmin
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (event_type) query = query.eq('event_type', event_type);
      if (severity) query = query.eq('severity', severity);
      if (from_date) query = query.gte('created_at', from_date);
      if (to_date) query = query.lte('created_at', to_date);

      const { data: logs, error } = await query;
      if (error) throw error;

      // Resolve actor emails
      const actorIds = [...new Set(logs?.map(l => l.actor_id).filter(Boolean) || [])];
      const emailMap = new Map<string, string>();
      if (actorIds.length > 0) {
        const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
        if (authUsers?.users) {
          for (const u of authUsers.users) {
            emailMap.set(u.id, u.email || 'unknown');
          }
        }
      }

      const enrichedLogs = (logs || []).map(l => ({
        ...l,
        actor_email: l.actor_id ? emailMap.get(l.actor_id) || 'unknown' : null,
      }));

      // Get total count
      const { count } = await supabaseAdmin
        .from('audit_logs')
        .select('id', { count: 'exact', head: true });

      return new Response(JSON.stringify({ success: true, logs: enrichedLogs, total: count }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'log') {
      // Manual audit log entry (for admin actions, auth events)
      const { event_type, target_id, target_type, details, severity = 'info' } = body;

      const { error } = await supabaseAdmin
        .from('audit_logs')
        .insert({
          event_type,
          actor_id: userId,
          target_id,
          target_type,
          details: details || {},
          severity,
        });

      if (error) throw error;

      // Check for incident patterns
      await checkForIncidents(supabaseAdmin, event_type, userId, details);

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get-alerts') {
      const { acknowledged } = body;
      let query = supabaseAdmin
        .from('incident_alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (acknowledged !== undefined) {
        query = query.eq('acknowledged', acknowledged);
      }

      const { data: alerts, error } = await query;
      if (error) throw error;

      return new Response(JSON.stringify({ success: true, alerts }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'acknowledge-alert') {
      const { alert_id } = body;
      const { error } = await supabaseAdmin
        .from('incident_alerts')
        .update({
          acknowledged: true,
          acknowledged_by: userId,
          acknowledged_at: new Date().toISOString(),
        })
        .eq('id', alert_id);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: false, error: 'Unknown action' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Audit log error:', error);
    return new Response(JSON.stringify({ success: false, error: 'Internal server error' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function checkForIncidents(supabaseAdmin: any, eventType: string, actorId: string, details: any) {
  try {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    // Check for mass deletions (>5 deletions in 5 minutes)
    if (eventType === 'recording.delete') {
      const { count } = await supabaseAdmin
        .from('audit_logs')
        .select('id', { count: 'exact', head: true })
        .eq('event_type', 'recording.delete')
        .eq('actor_id', actorId)
        .gte('created_at', fiveMinutesAgo.toISOString());

      if (count && count >= 5) {
        await supabaseAdmin.from('incident_alerts').insert({
          alert_type: 'mass_deletion',
          severity: 'critical',
          message: `Massenlöschung erkannt: ${count} Aufnahmen in 5 Minuten gelöscht`,
          details: { actor_id: actorId, count, timeframe: '5min' },
        });
      }
    }

    // Check for unusual admin actions (>10 admin actions in 5 minutes)
    if (eventType.startsWith('admin.')) {
      const { count } = await supabaseAdmin
        .from('audit_logs')
        .select('id', { count: 'exact', head: true })
        .like('event_type', 'admin.%')
        .eq('actor_id', actorId)
        .gte('created_at', fiveMinutesAgo.toISOString());

      if (count && count >= 10) {
        await supabaseAdmin.from('incident_alerts').insert({
          alert_type: 'unauthorized_access',
          severity: 'warning',
          message: `Ungewöhnliche Admin-Aktivität: ${count} Aktionen in 5 Minuten`,
          details: { actor_id: actorId, count, timeframe: '5min' },
        });
      }
    }
  } catch (err) {
    console.error('Incident check error:', err);
  }
}
