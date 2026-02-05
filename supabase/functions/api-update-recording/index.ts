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
 
   if (req.method !== 'PATCH' && req.method !== 'POST') {
     return new Response(JSON.stringify({ error: 'Method not allowed. Use PATCH or POST.' }), {
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
 
     // Validate API key with 'update' permission
     const keyRecord = await validateApiKey(supabase, apiKey, 'update');
     if (!keyRecord) {
       return new Response(JSON.stringify({ error: 'Invalid API key or missing update permission' }), {
         status: 401,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
       });
     }
 
     // Parse request body
     const body = await req.json();
     const { recording_id, title, participants, calendar_attendees } = body;
 
     // Validation
     if (!recording_id) {
       return new Response(JSON.stringify({ error: 'recording_id is required' }), {
         status: 400,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
       });
     }
 
     // Check if recording exists
     const { data: existingRecording, error: fetchError } = await supabase
       .from('recordings')
       .select('id, user_id, title, participants, calendar_attendees')
       .eq('id', recording_id)
       .maybeSingle();
 
     if (fetchError || !existingRecording) {
       return new Response(JSON.stringify({ error: 'Recording not found' }), {
         status: 404,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
       });
     }
 
     // Build update object with only provided fields
     const updateData: Record<string, any> = {};
     const updatedFields: string[] = [];
 
     if (title !== undefined) {
       updateData.title = title;
       updatedFields.push('title');
     }
 
     if (participants !== undefined) {
       updateData.participants = participants;
       updatedFields.push('participants');
     }
 
     if (calendar_attendees !== undefined) {
       updateData.calendar_attendees = calendar_attendees;
       updatedFields.push('calendar_attendees');
     }
 
     if (updatedFields.length === 0) {
       return new Response(JSON.stringify({ 
         error: 'No fields to update. Provide at least one of: title, participants, calendar_attendees' 
       }), {
         status: 400,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
       });
     }
 
     // Perform update
     const { error: updateError } = await supabase
       .from('recordings')
       .update(updateData)
       .eq('id', recording_id);
 
     if (updateError) {
       console.error('Update error:', updateError);
       return new Response(JSON.stringify({ error: 'Failed to update recording' }), {
         status: 500,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
       });
     }
 
     return new Response(JSON.stringify({
       success: true,
       recording_id,
       updated_fields: updatedFields,
       updated_at: new Date().toISOString(),
     }), {
       status: 200,
       headers: { ...corsHeaders, 'Content-Type': 'application/json' },
     });
 
   } catch (error) {
     console.error('API Update error:', error);
     return new Response(JSON.stringify({ error: 'Internal server error' }), {
       status: 500,
       headers: { ...corsHeaders, 'Content-Type': 'application/json' },
     });
   }
 });