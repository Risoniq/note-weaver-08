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

    if (action === 'run-check') {
      // Fetch all completed recordings with transcripts
      const { data: recordings, error: recError } = await supabaseAdmin
        .from('recordings')
        .select('id, user_id, title, created_at, transcript_text')
        .eq('status', 'done')
        .is('deleted_at', null)
        .not('transcript_text', 'is', null);

      if (recError) throw recError;

      const totalRecordings = recordings?.length || 0;
      let backupsFound = 0;
      let backupsMissing = 0;
      let backupsCorrupted = 0;
      const details: any[] = [];

      // Check backups in storage for each recording's user
      const userRecordings = new Map<string, typeof recordings>();
      for (const rec of recordings || []) {
        if (!rec.user_id) continue;
        const arr = userRecordings.get(rec.user_id) || [];
        arr.push(rec);
        userRecordings.set(rec.user_id, arr);
      }

      for (const [uId, recs] of userRecordings) {
        // List backup files for this user
        const { data: files, error: listError } = await supabaseAdmin.storage
          .from('transcript-backups')
          .list(uId, { limit: 1000 });

        if (listError) {
          details.push({ user_id: uId, status: 'error', message: `Fehler beim Lesen: ${listError.message}` });
          backupsMissing += recs.length;
          continue;
        }

        const fileNames = new Set((files || []).map(f => f.name));

        for (const rec of recs) {
          // Prefix-based match: any file starting with the recording ID counts
          const found = (files || []).some(f => f.name.startsWith(rec.id));

          if (found) {
            backupsFound++;
          } else {
            backupsMissing++;
            details.push({
              recording_id: rec.id,
              user_id: uId,
              title: rec.title || 'Untitled',
              status: 'missing',
              created_at: rec.created_at,
            });
          }
        }
      }

      // Determine overall status
      let status = 'passed';
      if (backupsCorrupted > 0) status = 'failed';
      else if (backupsMissing > 0 && backupsMissing > totalRecordings * 0.1) status = 'failed';
      else if (backupsMissing > 0) status = 'warning';

      // Save result
      const { data: check, error: insertError } = await supabaseAdmin
        .from('backup_integrity_checks')
        .insert({
          total_recordings: totalRecordings,
          backups_found: backupsFound,
          backups_missing: backupsMissing,
          backups_corrupted: backupsCorrupted,
          details: details.slice(0, 50), // Limit details
          status,
          run_by: userId,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Log to audit
      await supabaseAdmin.from('audit_logs').insert({
        event_type: 'backup.integrity_check',
        actor_id: userId,
        target_type: 'backup',
        details: { status, total: totalRecordings, found: backupsFound, missing: backupsMissing },
        severity: status === 'failed' ? 'critical' : status === 'warning' ? 'warning' : 'info',
      });

      // Create incident alert if failed
      if (status === 'failed') {
        await supabaseAdmin.from('incident_alerts').insert({
          alert_type: 'backup_failure',
          severity: 'critical',
          message: `Backup-Integritätsprüfung fehlgeschlagen: ${backupsMissing} fehlend, ${backupsCorrupted} beschädigt von ${totalRecordings} gesamt`,
          details: { check_id: check.id, total: totalRecordings, missing: backupsMissing, corrupted: backupsCorrupted },
        });
      }

      return new Response(JSON.stringify({ success: true, check }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'list-checks') {
      const { data: checks, error } = await supabaseAdmin
        .from('backup_integrity_checks')
        .select('*')
        .order('checked_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, checks }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: false, error: 'Unknown action' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Backup integrity check error:', error);
    return new Response(JSON.stringify({ success: false, error: 'Internal server error' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
