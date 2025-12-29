import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.208.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Validate meeting URL - only allow known meeting platforms
function validateMeetingUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);
    
    // Only allow HTTPS
    if (parsed.protocol !== 'https:') {
      return { valid: false, error: 'Only HTTPS URLs are allowed' };
    }
    
    // Whitelist known meeting platforms
    const allowedHosts = [
      'zoom.us',
      'us02web.zoom.us',
      'us04web.zoom.us',
      'us05web.zoom.us',
      'us06web.zoom.us',
      'teams.microsoft.com',
      'teams.live.com',
      'meet.google.com',
      'webex.com',
      'bluejeans.com',
      'gotomeeting.com',
      'whereby.com',
    ];
    
    const isAllowed = allowedHosts.some(host => 
      parsed.hostname === host || 
      parsed.hostname.endsWith('.' + host)
    );
    
    if (!isAllowed) {
      return { valid: false, error: 'URL must be from a supported meeting platform (Zoom, Teams, Google Meet, etc.)' };
    }
    
    // Prevent private IP ranges
    const privateIpPattern = /^(localhost|127\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/;
    if (privateIpPattern.test(parsed.hostname)) {
      return { valid: false, error: 'Private IP addresses are not allowed' };
    }
    
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

// Validate avatar URL - only allow Supabase storage URLs
function validateAvatarUrl(url: string): boolean {
  if (!url) return true; // Optional field
  
  try {
    const parsed = new URL(url);
    
    // Only allow HTTPS
    if (parsed.protocol !== 'https:') return false;
    
    // Only allow Supabase storage URLs
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (supabaseUrl && parsed.origin === supabaseUrl) {
      return true;
    }
    
    // Also allow common CDNs and image services
    const allowedHosts = [
      'supabase.co',
      'supabase.com',
    ];
    
    return allowedHosts.some(host => 
      parsed.hostname.endsWith('.' + host)
    );
  } catch {
    return false;
  }
}

// Funktion um ein Bild von einer URL zu laden und als Base64 zu konvertieren
async function fetchImageAsBase64(imageUrl: string): Promise<string | null> {
  try {
    console.log(`[Image] Lade Bild von: ${imageUrl}`);
    const response = await fetch(imageUrl);
    
    if (!response.ok) {
      console.error(`[Image] Fehler beim Laden: ${response.status}`);
      return null;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const base64String = base64Encode(uint8Array);
    
    console.log(`[Image] Bild erfolgreich geladen und konvertiert (${base64String.length} chars)`);
    return base64String;
  } catch (error) {
    console.error(`[Image] Fehler beim Konvertieren:`, error);
    return null;
  }
}

// Helper: Authenticate user from request
async function authenticateUser(req: Request): Promise<{ user: { id: string; email?: string } | null; error?: string }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return { user: null, error: 'Authorization header required' };
  }

  const token = authHeader.replace('Bearer ', '');
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  
  if (authError || !user) {
    console.error('[Auth] Authentication failed:', authError?.message);
    return { user: null, error: 'Invalid or expired token' };
  }

  return { user: { id: user.id, email: user.email } };
}

Deno.serve(async (req) => {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Authenticate user
    const { user, error: authError } = await authenticateUser(req);
    if (!user) {
      return new Response(
        JSON.stringify({ error: authError || 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Auth] Authenticated user: ${user.id}`);

    // 2. Daten vom Frontend holen
    const { meetingUrl, botName, botAvatarUrl } = await req.json();

    if (!meetingUrl) {
      return new Response(
        JSON.stringify({ error: "Meeting URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Validate meeting URL
    const urlValidation = validateMeetingUrl(meetingUrl);
    if (!urlValidation.valid) {
      console.error(`[Validation] Invalid meeting URL: ${urlValidation.error}`);
      return new Response(
        JSON.stringify({ error: urlValidation.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Validate avatar URL if provided
    if (botAvatarUrl && !validateAvatarUrl(botAvatarUrl)) {
      console.error(`[Validation] Invalid avatar URL`);
      return new Response(
        JSON.stringify({ error: "Invalid avatar URL. Only Supabase storage URLs are allowed." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Supabase Client initialisieren (Service Role for DB writes)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 6. Recall API Konfiguration laden
    const recallApiKey = Deno.env.get("RECALL_API_KEY");
    const recallApiUrl = Deno.env.get("RECALL_API_URL") || "https://us-west-2.recall.ai/api/v1/bot";

    if (!recallApiKey) {
      console.error('[Config] RECALL_API_KEY is not set');
      return new Response(
        JSON.stringify({ error: "Service configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const finalBotName = botName || "Notetaker Bot";
    console.log(`[Recall] Sende Bot zu: ${meetingUrl}`);
    console.log(`[Recall] Bot Name: ${finalBotName}`);
    console.log(`[Recall] Bot Avatar URL: ${botAvatarUrl || "nicht gesetzt"}`);

    // 7. Bot-Konfiguration erstellen
    const botConfig: Record<string, unknown> = {
      meeting_url: meetingUrl,
      bot_name: finalBotName,
      join_at: new Date().toISOString(),
      // Speaker Timeline für Sprecher-Identifikation aktivieren
      speaker_timeline: {
        enabled: true
      },
      // Automatisches Verlassen konfigurieren - längere Wartezeit im Wartebereich
      automatic_leave: {
        waiting_room_timeout: 600, // 10 Minuten im Wartebereich warten
        noone_joined_timeout: 300, // 5 Minuten warten wenn niemand beitritt
        everyone_left_timeout: 60  // 1 Minute warten nachdem alle gegangen sind
      },
      recording_config: {
        transcript: {
          provider: { 
            recallai_streaming: {
              mode: "prioritize_accuracy",
              language_code: "auto"
            }
          }
        }
      }
    };
    
    // Bot-Profilbild als Video-Output setzen (funktioniert für Teams, Zoom, Meet)
    if (botAvatarUrl) {
      try {
        const base64Image = await fetchImageAsBase64(botAvatarUrl);
        
        if (base64Image) {
          // automatic_video_output zeigt das Bild als Bot-Video/Profilbild
          botConfig.automatic_video_output = {
            in_call_not_recording: {
              kind: "jpeg",
              b64_data: base64Image
            },
            in_call_recording: {
              kind: "jpeg", 
              b64_data: base64Image
            }
          };
          console.log(`[Recall] Bot Avatar als Video-Output konfiguriert`);
        }
      } catch (imageError) {
        console.error(`[Recall] Konnte Avatar nicht laden:`, imageError);
      }
    }

    // 8. Bot bei Recall.ai erstellen
    const recallResponse = await fetch(recallApiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Token ${recallApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(botConfig),
    });

    if (!recallResponse.ok) {
      const errorText = await recallResponse.text();
      console.error("[Recall] API Fehler:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to create meeting bot" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const botData = await recallResponse.json();
    console.log(`[Recall] Bot erstellt. ID: ${botData.id}`);

    // 9. Generiere eine meeting_id (NOT NULL constraint)
    const meetingId = crypto.randomUUID();

    // 10. Bot-Daten in Supabase speichern mit user_id
    const { data: dbData, error: dbError } = await supabase
      .from("recordings")
      .insert({
        meeting_id: meetingId,
        meeting_url: meetingUrl,
        recall_bot_id: botData.id,
        status: "joining",
        user_id: user.id, // Associate recording with authenticated user
      })
      .select()
      .single();

    if (dbError) {
      console.error("[Supabase] DB Fehler:", dbError);
      return new Response(
        JSON.stringify({ error: "Failed to save recording" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Supabase] Recording erstellt: ${dbData.id}`);

    // 11. Erfolgsmeldung zurück ans Frontend
    return new Response(
      JSON.stringify({
        success: true,
        meetingId: dbData.meeting_id,
        bot_id: botData.id,
        recording: dbData,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[create-bot] Fehler:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred processing your request" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
