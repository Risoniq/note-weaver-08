import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const allowedOrigins = [
    Deno.env.get('APP_URL') || '',
    'https://notetaker2pro.com',
    'https://www.notetaker2pro.com',
    'http://localhost:5173',
    'http://localhost:8080',
    'http://localhost:3000',
  ].filter(Boolean);

  const isLovablePreview = origin.endsWith('.lovableproject.com') || origin.endsWith('.lovable.app');
  const allowOrigin = allowedOrigins.includes(origin) || isLovablePreview ? origin : '*';

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
    'Access-Control-Allow-Credentials': 'true',
  };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth token and verify admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Nicht autorisiert' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Ungültiges Token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify admin role
    const { data: isAdmin } = await supabaseAdmin.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin',
    });

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Keine Admin-Berechtigung' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const { target_user_id, data_type, recording_id } = await req.json();

    if (!target_user_id) {
      return new Response(JSON.stringify({ error: 'target_user_id erforderlich' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let responseData: Record<string, unknown> = {};

    // Fetch data based on data_type
    switch (data_type) {
      case 'recordings': {
        const { data: recordings, error } = await supabaseAdmin
          .from('recordings')
          .select('*')
          .eq('user_id', target_user_id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        responseData = { recordings: recordings || [] };
        break;
      }

      case 'bot_settings': {
        const { data: botSettings, error } = await supabaseAdmin
          .from('recall_calendar_users')
          .select('*')
          .eq('supabase_user_id', target_user_id)
          .maybeSingle();

        if (error) throw error;
        responseData = { bot_settings: botSettings };
        break;
      }

      case 'quota': {
        // Get quota settings
        const { data: quotaData } = await supabaseAdmin
          .from('user_quotas')
          .select('max_minutes')
          .eq('user_id', target_user_id)
          .maybeSingle();

        const maxMinutes = quotaData?.max_minutes ?? 120;

        // Calculate used minutes from recordings
        const { data: recordings } = await supabaseAdmin
          .from('recordings')
          .select('duration')
          .eq('user_id', target_user_id)
          .eq('status', 'done');

        const usedSeconds = recordings?.reduce((sum, r) => sum + (r.duration || 0), 0) || 0;
        const usedMinutes = Math.round(usedSeconds / 60);

        responseData = {
          quota: {
            max_minutes: maxMinutes,
            used_minutes: usedMinutes,
            remaining_minutes: Math.max(0, maxMinutes - usedMinutes),
            percentage_used: Math.min(100, (usedMinutes / maxMinutes) * 100),
            is_exhausted: usedMinutes >= maxMinutes,
          },
        };
        break;
      }

      case 'transcript_backups': {
        const { data: backups, error } = await supabaseAdmin.storage
          .from('transcript-backups')
          .list(target_user_id, {
            sortBy: { column: 'created_at', order: 'desc' },
          });

        if (error) throw error;
        responseData = {
          transcript_backups: (backups || []).map((file) => ({
            name: file.name,
            created_at: file.created_at || '',
            size: file.metadata?.size || 0,
          })),
        };
        break;
      }

      case 'single_recording': {
        if (!recording_id) {
          return new Response(JSON.stringify({ error: 'recording_id erforderlich' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { data: singleRecording, error } = await supabaseAdmin
          .from('recordings')
          .select('*')
          .eq('id', recording_id)
          .eq('user_id', target_user_id)
          .maybeSingle();

        if (error) throw error;
        responseData = { recording: singleRecording };
        break;
      }

      case 'all': {
        // Fetch all data at once
        const [recordingsResult, botSettingsResult, quotaResult, backupsResult] = await Promise.all([
          supabaseAdmin
            .from('recordings')
            .select('*')
            .eq('user_id', target_user_id)
            .order('created_at', { ascending: false }),
          supabaseAdmin
            .from('recall_calendar_users')
            .select('*')
            .eq('supabase_user_id', target_user_id)
            .maybeSingle(),
          supabaseAdmin
            .from('user_quotas')
            .select('max_minutes')
            .eq('user_id', target_user_id)
            .maybeSingle(),
          supabaseAdmin.storage
            .from('transcript-backups')
            .list(target_user_id, { sortBy: { column: 'created_at', order: 'desc' } }),
        ]);

        // Calculate quota
        const maxMinutes = quotaResult.data?.max_minutes ?? 120;
        const { data: doneRecordings } = await supabaseAdmin
          .from('recordings')
          .select('duration')
          .eq('user_id', target_user_id)
          .eq('status', 'done');

        const usedSeconds = doneRecordings?.reduce((sum, r) => sum + (r.duration || 0), 0) || 0;
        const usedMinutes = Math.round(usedSeconds / 60);

        responseData = {
          recordings: recordingsResult.data || [],
          bot_settings: botSettingsResult.data,
          quota: {
            max_minutes: maxMinutes,
            used_minutes: usedMinutes,
            remaining_minutes: Math.max(0, maxMinutes - usedMinutes),
            percentage_used: Math.min(100, (usedMinutes / maxMinutes) * 100),
            is_exhausted: usedMinutes >= maxMinutes,
          },
          transcript_backups: (backupsResult.data || []).map((file) => ({
            name: file.name,
            created_at: file.created_at || '',
            size: file.metadata?.size || 0,
          })),
        };
        break;
      }

      default:
        return new Response(JSON.stringify({ error: 'Ungültiger data_type' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Admin view user data error:', error);
    return new Response(JSON.stringify({ error: 'Interner Serverfehler' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
