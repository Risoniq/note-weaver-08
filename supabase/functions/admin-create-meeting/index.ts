import { createClient } from 'npm:@supabase/supabase-js@2';

// Dynamic CORS headers based on origin
function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const allowedOrigins = [
    Deno.env.get('APP_URL') || '',
    'http://localhost:5173',
    'http://localhost:8080',
    'http://localhost:3000',
  ].filter(Boolean);
  
  const isLovablePreview = origin.endsWith('.lovableproject.com') || origin.endsWith('.lovable.app');
  const allowOrigin = allowedOrigins.includes(origin) || isLovablePreview 
    ? origin 
    : allowedOrigins[0] || '*';
  
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
  };
}

// Helper: Authenticate user from request
async function authenticateUser(req: Request): Promise<{ user: { id: string } | null; error?: string }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return { user: null, error: 'Authorization header required' };
  }

  const token = authHeader.replace('Bearer ', '');
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  
  if (authError || !user) {
    console.error('[Auth] Authentication failed:', authError?.message);
    return { user: null, error: 'Invalid or expired token' };
  }

  return { user: { id: user.id } };
}

// Check if user has admin role
async function isAdmin(userId: string): Promise<boolean> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle();
  
  return data !== null;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Authenticate user
    const { user, error: authError } = await authenticateUser(req);
    if (!user) {
      return new Response(
        JSON.stringify({ error: authError || 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[admin-create-meeting] Authenticated user: ${user.id}`);

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 2. Verify admin role
    const hasAdminRole = await isAdmin(user.id);
    if (!hasAdminRole) {
      console.error(`[Auth] User ${user.id} is not an admin`);
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[admin-create-meeting] Admin verified: ${user.id}`);

    // 3. Parse request body
    const body = await req.json();
    const { 
      target_user_id, 
      title, 
      transcript_text, 
      meeting_date,
      duration 
    } = body;

    // 4. Validate required fields
    if (!target_user_id) {
      return new Response(
        JSON.stringify({ error: 'target_user_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!transcript_text) {
      return new Response(
        JSON.stringify({ error: 'transcript_text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (transcript_text.length < 100) {
      return new Response(
        JSON.stringify({ error: 'Transcript must be at least 100 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (transcript_text.length > 500000) {
      return new Response(
        JSON.stringify({ error: 'Transcript exceeds maximum length of 500,000 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[admin-create-meeting] Creating meeting for user: ${target_user_id}`);
    console.log(`[admin-create-meeting] Transcript length: ${transcript_text.length} characters`);

    // 5. Generate unique meeting ID
    const meetingId = crypto.randomUUID();

    // 6. Create recording entry
    const recordingData = {
      meeting_id: meetingId,
      user_id: target_user_id,
      status: 'processing',
      transcript_text: transcript_text,
      title: title || null, // Will be generated by AI if null
      source: 'admin_upload',
      created_at: meeting_date || new Date().toISOString(),
      duration: duration || null,
    };

    const { data: recording, error: insertError } = await supabase
      .from('recordings')
      .insert(recordingData)
      .select('id')
      .single();

    if (insertError || !recording) {
      console.error('[admin-create-meeting] Failed to create recording:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create meeting recording' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[admin-create-meeting] Recording created: ${recording.id}`);

    // 7. Call analyze-transcript Edge Function
    const analyzeResponse = await fetch(`${supabaseUrl}/functions/v1/analyze-transcript`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ recording_id: recording.id }),
    });

    if (!analyzeResponse.ok) {
      const errorText = await analyzeResponse.text();
      console.error('[admin-create-meeting] Analysis failed:', errorText);
      
      // Update status to error
      await supabase
        .from('recordings')
        .update({ status: 'error' })
        .eq('id', recording.id);
      
      return new Response(
        JSON.stringify({ error: 'Meeting created but analysis failed', recording_id: recording.id }),
        { status: 207, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const analysisResult = await analyzeResponse.json();
    console.log('[admin-create-meeting] Analysis completed successfully');

    // 8. Update status to done
    const { error: updateError } = await supabase
      .from('recordings')
      .update({ status: 'done' })
      .eq('id', recording.id);

    if (updateError) {
      console.error('[admin-create-meeting] Failed to update status:', updateError);
    }

    console.log(`[admin-create-meeting] Meeting created and analyzed: ${recording.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        recording_id: recording.id,
        meeting_id: meetingId,
        title: analysisResult.title || title,
        summary: analysisResult.summary,
        key_points: analysisResult.key_points,
        action_items: analysisResult.action_items,
        word_count: analysisResult.word_count,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[admin-create-meeting] Error:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred processing your request' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
