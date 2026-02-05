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
 
     // Validate API key with 'webhook_receive' permission
     const keyRecord = await validateApiKey(supabase, apiKey, 'webhook_receive');
     if (!keyRecord) {
       return new Response(JSON.stringify({ error: 'Invalid API key or missing webhook_receive permission' }), {
         status: 401,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
       });
     }
 
     // Parse request body
     const body = await req.json();
     const {
       event_type,
       source,
       external_meeting_id,
       target_user_email,
       data = {},
     } = body;
 
     // Validation
     if (!event_type) {
       return new Response(JSON.stringify({ error: 'event_type is required' }), {
         status: 400,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
       });
     }
 
     if (!target_user_email) {
       return new Response(JSON.stringify({ error: 'target_user_email is required' }), {
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
 
     let result: any = { event_type, processed: false };
 
     // Handle different event types
     switch (event_type) {
       case 'transcript_ready':
       case 'meeting_ended': {
         const { transcript, video_url, participants, title, duration_seconds } = data;
 
         if (!transcript || transcript.length < 100) {
           return new Response(JSON.stringify({ error: 'data.transcript must be at least 100 characters' }), {
             status: 400,
             headers: { ...corsHeaders, 'Content-Type': 'application/json' },
           });
         }
 
         const wordCount = transcript.split(/\s+/).filter((w: string) => w.length > 0).length;
         const meetingId = external_meeting_id || `webhook-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
 
         // Check if recording with this external_meeting_id already exists
         let existingRecording = null;
         if (external_meeting_id) {
           const { data: existing } = await supabase
             .from('recordings')
             .select('id')
             .eq('meeting_id', external_meeting_id)
             .eq('user_id', targetUser.id)
             .maybeSingle();
           existingRecording = existing;
         }
 
         if (existingRecording) {
           // Update existing recording
           const { error: updateError } = await supabase
             .from('recordings')
             .update({
               transcript_text: transcript,
               video_url: video_url || null,
               participants: participants || null,
               title: title || null,
               duration: duration_seconds || null,
               word_count: wordCount,
               status: 'done',
             })
             .eq('id', existingRecording.id);
 
           if (updateError) {
             console.error('Update error:', updateError);
             return new Response(JSON.stringify({ error: 'Failed to update recording' }), {
               status: 500,
               headers: { ...corsHeaders, 'Content-Type': 'application/json' },
             });
           }
 
           result = {
             event_type,
             processed: true,
             action: 'updated',
             recording_id: existingRecording.id,
           };
         } else {
           // Create new recording
           const { data: recording, error: insertError } = await supabase
             .from('recordings')
             .insert({
               meeting_id: meetingId,
               user_id: targetUser.id,
               title: title || null,
               transcript_text: transcript,
               video_url: video_url || null,
               status: 'done',
               source: source || 'webhook',
               duration: duration_seconds || null,
               word_count: wordCount,
               participants: participants || null,
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
 
           // Trigger AI analysis
           try {
             await fetch(`${supabaseUrl}/functions/v1/analyze-transcript`, {
               method: 'POST',
               headers: {
                 'Content-Type': 'application/json',
                 'Authorization': `Bearer ${supabaseServiceKey}`,
               },
               body: JSON.stringify({ recording_id: recording.id }),
             });
           } catch (analyzeError) {
             console.error('Analysis trigger error:', analyzeError);
           }
 
           result = {
             event_type,
             processed: true,
             action: 'created',
             recording_id: recording.id,
           };
         }
         break;
       }
 
       case 'meeting_started': {
         // Just acknowledge - could be used for real-time status updates
         result = {
           event_type,
           processed: true,
           action: 'acknowledged',
           message: 'Meeting start event received',
         };
         break;
       }
 
       default:
         result = {
           event_type,
           processed: false,
           message: `Unknown event type: ${event_type}. Supported: transcript_ready, meeting_ended, meeting_started`,
         };
     }
 
     return new Response(JSON.stringify({
       success: true,
       ...result,
       received_at: new Date().toISOString(),
     }), {
       status: 200,
       headers: { ...corsHeaders, 'Content-Type': 'application/json' },
     });
 
   } catch (error) {
     console.error('Webhook callback error:', error);
     return new Response(JSON.stringify({ error: 'Internal server error' }), {
       status: 500,
       headers: { ...corsHeaders, 'Content-Type': 'application/json' },
     });
   }
 });