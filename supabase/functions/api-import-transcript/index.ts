 import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
 
 const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
 };
 
 // SHA-256 hash function
 async function sha256(message: string): Promise<string> {
   const msgBuffer = new TextEncoder().encode(message);
   const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
   const hashArray = Array.from(new Uint8Array(hashBuffer));
   return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
 }
 
 // Validate API key and check permissions
 async function validateApiKey(supabase: any, apiKey: string, permission: string) {
   const keyHash = await sha256(apiKey);
   
   const { data: keyRecord, error } = await supabase
     .from('api_keys')
     .select('*')
     .eq('key_hash', keyHash)
     .eq('is_active', true)
     .maybeSingle();
   
   if (error || !keyRecord) return null;
   if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) return null;
   if (!keyRecord.permissions[permission]) return null;
   
   // Update last used
   await supabase.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', keyRecord.id);
   
   return keyRecord;
 }
 
 Deno.serve(async (req) => {
   if (req.method === 'OPTIONS') {
     return new Response(null, { headers: corsHeaders });
   }
 
   if (req.method !== 'POST') {
     return new Response(JSON.stringify({ error: 'Method not allowed' }), {
       status: 405,
       headers: { ...corsHeaders, 'Content-Type': 'application/json' },
     });
   }
 
   try {
     const apiKey = req.headers.get('x-api-key');
     
     if (!apiKey) {
       return new Response(JSON.stringify({ error: 'API key required' }), {
         status: 401,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
       });
     }
 
     const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
     const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
     const supabase = createClient(supabaseUrl, supabaseServiceKey);
 
     // Validate API key with 'import' permission
     const keyRecord = await validateApiKey(supabase, apiKey, 'import');
     if (!keyRecord) {
       return new Response(JSON.stringify({ error: 'Invalid API key or missing import permission' }), {
         status: 401,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
       });
     }
 
     // Parse request body
     const body = await req.json();
     const {
       target_user_email,
       title,
       transcript_text,
       meeting_date,
       duration_seconds,
       source = 'api_import',
       participants,
       run_analysis = false,
     } = body;
 
     // Validation
     if (!target_user_email) {
       return new Response(JSON.stringify({ error: 'target_user_email is required' }), {
         status: 400,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
       });
     }
 
     if (!transcript_text || transcript_text.length < 100) {
       return new Response(JSON.stringify({ error: 'transcript_text must be at least 100 characters' }), {
         status: 400,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
       });
     }
 
     if (transcript_text.length > 500000) {
       return new Response(JSON.stringify({ error: 'transcript_text must not exceed 500,000 characters' }), {
         status: 400,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
       });
     }
 
     // Look up user by email
     const { data: authUsers } = await supabase.auth.admin.listUsers();
     const targetUser = authUsers?.users.find(u => u.email?.toLowerCase() === target_user_email.toLowerCase());
 
     if (!targetUser) {
       return new Response(JSON.stringify({ error: 'User with this email not found' }), {
         status: 404,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
       });
     }
 
     // Calculate word count
     const wordCount = transcript_text.split(/\s+/).filter((w: string) => w.length > 0).length;
 
     // Create meeting_id
     const meetingId = `api-import-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
 
     // Insert recording
     const { data: recording, error: insertError } = await supabase
       .from('recordings')
       .insert({
         meeting_id: meetingId,
         user_id: targetUser.id,
         title: title || null,
         transcript_text,
         status: run_analysis ? 'processing' : 'done',
         source,
         duration: duration_seconds || null,
         word_count: wordCount,
         participants: participants || null,
         created_at: meeting_date || new Date().toISOString(),
       })
       .select()
       .single();
 
     if (insertError) {
       console.error('Insert error:', insertError);
       return new Response(JSON.stringify({ error: 'Failed to create recording' }), {
         status: 500,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
       });
     }
 
     // Run AI analysis if requested
     let analysisResult = null;
     if (run_analysis) {
       try {
         const analyzeResponse = await fetch(`${supabaseUrl}/functions/v1/analyze-transcript`, {
           method: 'POST',
           headers: {
             'Content-Type': 'application/json',
             'Authorization': `Bearer ${supabaseServiceKey}`,
           },
           body: JSON.stringify({ recording_id: recording.id }),
         });
 
         if (analyzeResponse.ok) {
           analysisResult = await analyzeResponse.json();
         }
       } catch (analyzeError) {
         console.error('Analysis error:', analyzeError);
         // Continue without analysis
       }
     }
 
     // Fetch updated recording
     const { data: updatedRecording } = await supabase
       .from('recordings')
       .select('*')
       .eq('id', recording.id)
       .single();
 
     return new Response(JSON.stringify({
       success: true,
       recording_id: recording.id,
       title: updatedRecording?.title || title,
       status: updatedRecording?.status || 'done',
       summary: updatedRecording?.summary || null,
       key_points: updatedRecording?.key_points || null,
       action_items: updatedRecording?.action_items || null,
       word_count: wordCount,
       imported_at: new Date().toISOString(),
     }), {
       status: 201,
       headers: { ...corsHeaders, 'Content-Type': 'application/json' },
     });
 
   } catch (error) {
     console.error('API Import error:', error);
     return new Response(JSON.stringify({ error: 'Internal server error' }), {
       status: 500,
       headers: { ...corsHeaders, 'Content-Type': 'application/json' },
     });
   }
 });