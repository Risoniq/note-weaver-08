import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper: Authenticate user from request
async function authenticateUser(req: Request): Promise<{ user: { id: string } | null; error?: string; isServiceRole?: boolean }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return { user: null, error: 'Authorization header required' };
  }

  const token = authHeader.replace('Bearer ', '');
  
  // Check if this is a service role call (internal)
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (token === serviceRoleKey) {
    return { user: { id: 'service-role' }, isServiceRole: true };
  }

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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Authenticate user
    const { user, error: authError, isServiceRole } = await authenticateUser(req);
    if (!user) {
      return new Response(
        JSON.stringify({ error: authError || 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Auth] Authenticated: ${isServiceRole ? 'service-role' : user.id}`);

    const { recording_id } = await req.json();
    
    if (!recording_id) {
      console.error('Missing recording_id');
      return new Response(
        JSON.stringify({ error: 'recording_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Analyzing transcript for recording: ${recording_id}`);

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the recording
    const { data: recording, error: fetchError } = await supabase
      .from('recordings')
      .select('transcript_text, title, user_id')
      .eq('id', recording_id)
      .single();

    if (fetchError || !recording) {
      console.error('Recording not found:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Recording not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Verify ownership (skip for service role calls)
    if (!isServiceRole && recording.user_id && recording.user_id !== user.id) {
      console.error(`[Auth] User ${user.id} tried to analyze recording owned by ${recording.user_id}`);
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!recording.transcript_text) {
      console.log('No transcript available for analysis');
      return new Response(
        JSON.stringify({ error: 'No transcript available' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const transcript = recording.transcript_text;
    console.log(`Transcript length: ${transcript.length} characters`);

    // Call Lovable AI for analysis
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `Du bist ein professioneller Meeting-Analyst. Analysiere das folgende Meeting-Transkript und extrahiere:
1. Einen kurzen Titel für das Meeting (max 50 Zeichen)
2. Eine prägnante Zusammenfassung (2-3 Sätze)
3. Die 3-5 wichtigsten Punkte als Liste
4. Konkrete Action Items mit Verantwortlichen (falls erwähnt)

WICHTIGE REGELN:
- Schreibe IMMER professionell und freundlich
- Verwende KEINE Markdown-Formatierung (keine Sterne *, keine Unterstriche _)
- Übernimme NIEMALS Schimpfwörter, Beleidigungen oder unangemessene Sprache - formuliere diese neutral um
- Übernimme NIEMALS Passwörter, Zugangsdaten oder sensible Informationen - ersetze diese durch "[ENTFERNT]"
- Halte den Ton sachlich und respektvoll

Antworte NUR im folgenden JSON-Format, ohne zusätzlichen Text:
{
  "title": "Meeting-Titel",
  "summary": "Zusammenfassung des Meetings...",
  "key_points": ["Punkt 1", "Punkt 2", "Punkt 3"],
  "action_items": ["Action Item 1", "Action Item 2"]
}`;

    console.log('Calling Lovable AI for analysis...');
    
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analysiere dieses Meeting-Transkript:\n\n${transcript}` }
        ],
      }),
    });

    if (!aiResponse.ok) {
      console.error(`AI API error: ${aiResponse.status}`);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add credits.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'AI analysis failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;
    
    if (!content) {
      console.error('No content in AI response');
      return new Response(
        JSON.stringify({ error: 'Empty AI response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('AI Response received');

    // Parse the JSON response
    let analysis;
    try {
      // Clean the response - remove markdown code blocks if present
      const cleanedContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysis = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      return new Response(
        JSON.stringify({ error: 'Failed to parse AI response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate word count
    const wordCount = transcript.split(/\s+/).filter((word: string) => word.length > 0).length;

    // Update the recording with analysis results
    const { error: updateError } = await supabase
      .from('recordings')
      .update({
        title: analysis.title || recording.title,
        summary: analysis.summary,
        key_points: analysis.key_points || [],
        action_items: analysis.action_items || [],
        word_count: wordCount,
      })
      .eq('id', recording_id);

    if (updateError) {
      console.error('Failed to update recording:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to save analysis' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Analysis saved successfully');

    return new Response(
      JSON.stringify({
        success: true,
        title: analysis.title,
        summary: analysis.summary,
        key_points: analysis.key_points,
        action_items: analysis.action_items,
        word_count: wordCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in analyze-transcript:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred processing your request' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
