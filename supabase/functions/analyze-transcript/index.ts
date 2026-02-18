import { createClient } from "npm:@supabase/supabase-js@2";

// Dynamic CORS headers based on origin
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
  
  // Check if origin matches allowed origins or is a Lovable preview domain
  const isLovablePreview = origin.endsWith('.lovableproject.com') || origin.endsWith('.lovable.app');
  const allowOrigin = allowedOrigins.includes(origin) || isLovablePreview 
    ? origin 
    : '*';
  
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
  };
}

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

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
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

    // 2. Verify ownership (skip for service role calls, admins can access all)
    if (!isServiceRole && recording.user_id && recording.user_id !== user.id) {
      // Check if user is admin
      const { data: adminCheck } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
      
      if (!adminCheck) {
        console.error(`[Auth] User ${user.id} tried to analyze recording owned by ${recording.user_id}`);
        return new Response(
          JSON.stringify({ error: 'Access denied' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log(`[Auth] Admin ${user.id} analyzing recording owned by ${recording.user_id}`);
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

    // Check if title is generic and should be overwritten by AI
    const isGenericTitle = (title: string | null): boolean => {
      if (!title || title.trim() === '') return true;
      const t = title.trim().toLowerCase();
      const genericTerms = [
        'meeting', 'besprechung', 'untitled', 'aufnahme', 'recording',
        'call', 'anruf', 'konferenz', 'conference', 'session',
        'notetaker', 'note taker', 'bot',
      ];
      // Exact match with generic term
      if (genericTerms.some(term => t === term)) return true;
      // Starts with generic term + only whitespace/numbers/punctuation after
      if (genericTerms.some(term => t.startsWith(term) && /^[\s\d\-_.:]+$/.test(t.slice(term.length)))) return true;
      // UUID fragment (8+ hex chars)
      if (/^[0-9a-f]{8,}/i.test(t)) return true;
      // Very short (≤3 chars)
      if (t.length <= 3) return true;
      return false;
    };

    const needsTitle = isGenericTitle(recording.title);
    console.log(`Needs title: ${needsTitle} (current: "${recording.title || 'none'}")`);

    // Call Lovable AI for analysis
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build dynamic system prompt based on whether title is needed
    const titleInstruction = !needsTitle 
      ? '' 
      : '1. Einen spezifischen, aussagekräftigen Titel für das Meeting (max 80 Zeichen)\n';
    
    const numbering = !needsTitle 
      ? { summary: '1', keyPoints: '2', actionItems: '3' }
      : { summary: '2', keyPoints: '3', actionItems: '4' };

    const jsonFormat = !needsTitle
      ? `{
  "summary": "Zusammenfassung des Meetings...",
  "key_points": ["Punkt 1", "Punkt 2", "Punkt 3"],
  "action_items": ["Aufgabe (Verantwortlicher: Name)", "Aufgabe (Verantwortlicher: Nicht zugewiesen)"]
}`
      : `{
  "title": "Spezifischer Meeting-Titel mit Kontext",
  "summary": "Zusammenfassung des Meetings...",
  "key_points": ["Punkt 1", "Punkt 2", "Punkt 3"],
  "action_items": ["Aufgabe (Verantwortlicher: Name)", "Aufgabe (Verantwortlicher: Nicht zugewiesen)"]
}`;

    const systemPrompt = `Du bist ein professioneller Meeting-Analyst. Analysiere das folgende Meeting-Transkript und extrahiere:
${titleInstruction}${numbering.summary}. Eine prägnante Zusammenfassung (2-3 Sätze)
${numbering.keyPoints}. Die 3-5 wichtigsten Punkte als Liste
${numbering.actionItems}. Konkrete Action Items mit Verantwortlichen

WICHTIGE REGELN FÜR ACTION ITEMS:
- Ein Action Item ist NUR eine konkrete, umsetzbare Aufgabe, die EXPLIZIT vereinbart, zugesagt oder zugewiesen wurde
- Es müssen MINDESTENS ZWEI der folgenden Kriterien erfüllt sein:
  a) Klare Handlung (z.B. "schicken", "erstellen", "prüfen", "organisieren", "vorbereiten", "einrichten")
  b) Verantwortliche Person (namentlich genannt oder "ich mache das", "ich kümmere mich")
  c) Zeitrahmen oder Deadline (z.B. "bis Freitag", "nächste Woche", "bis Ende des Monats")
- KEINE Action Items aus:
  - Allgemeinen Überlegungen ("man könnte...", "wäre gut wenn...", "vielleicht sollten wir...")
  - Wünschen oder Hoffnungen ("ich hoffe...", "wäre schön wenn...")
  - Einzelnen Kommentaren oder Meinungsäußerungen
  - Wiederholungen desselben Punkts (nur einmal erfassen)
  - Kontextlosen Erwähnungen von Tätigkeiten in der Vergangenheit ("wir haben letzte Woche...")
  - Fragen ohne klare Zusage ("sollten wir vielleicht...?")
- Fasse zusammengehörige Aufgaben zu EINEM Action Item zusammen
- Maximal 8 Action Items pro Meeting - nur die wichtigsten
- Im Zweifel ist es KEIN Action Item
- Extrahiere die Namen der verantwortlichen Personen DIREKT aus dem Transkript
- Wenn keine konkrete Person genannt wird, schreibe "Verantwortlicher: Nicht zugewiesen"
- Format: "Aufgabenbeschreibung (Verantwortlicher: [Name aus Transkript])"
- Sei STRIKT und KONSISTENT: Bei identischem Transkript müssen immer die gleichen Action Items extrahiert werden
${needsTitle ? `
WICHTIGE REGELN FÜR DEN TITEL:
- Der Titel MUSS das SPEZIFISCHE Thema des Meetings widerspiegeln, NICHT nur die Meeting-Art
- Extrahiere konkrete Firmennamen, Projektnamen, Kundennamen oder Themen aus dem Gespräch
- Verwende Teilnehmer-Namen oder Firmen wenn sie das Meeting charakterisieren
- Max 80 Zeichen
- GUTE Beispiele: "Projekt Alpha - Sprint Review mit Firma XY", "Vertriebsgespräch Müller GmbH - Angebot Q2", "Produktlaunch App v3.0 - Marketingplanung"
- SCHLECHTE Beispiele: "Team Meeting", "Besprechung", "Call", "Meeting 14.01." - diese sind zu generisch!
- Wenn das Meeting keinen klaren Fokus hat, nutze das dominante Thema + Kontext (z.B. Teilnehmer oder Datum-Bezug)
` : ''}
WEITERE REGELN:
- Schreibe IMMER professionell und freundlich
- Verwende KEINE Markdown-Formatierung (keine Sterne *, keine Unterstriche _)
- Übernimme NIEMALS Schimpfwörter, Beleidigungen oder unangemessene Sprache - formuliere diese neutral um
- Übernimme NIEMALS Passwörter, Zugangsdaten oder sensible Informationen - ersetze diese durch "[ENTFERNT]"
- Halte den Ton sachlich und respektvoll

Antworte NUR im folgenden JSON-Format, ohne zusätzlichen Text:
${jsonFormat}`;

    console.log('Calling Lovable AI for analysis...');
    
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        temperature: 0,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analysiere dieses Meeting-Transkript:\n\n${transcript}` }
        ],
      }),
    });

    if (!aiResponse.ok) {
      console.error('[Internal] AI API error:', aiResponse.status);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Service temporarily unavailable. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Service unavailable. Please contact support.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Analysis failed. Please try again.' }),
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

    console.log('AI Response received, length:', content.length);

    // Robust JSON extraction
    let analysis;
    try {
      // Try multiple extraction strategies
      let jsonStr = content;
      
      // Strategy 1: Remove markdown code blocks
      jsonStr = jsonStr.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      
      // Strategy 2: Find JSON object boundaries if still not valid
      if (!jsonStr.startsWith('{')) {
        const startIdx = jsonStr.indexOf('{');
        const endIdx = jsonStr.lastIndexOf('}');
        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
          jsonStr = jsonStr.slice(startIdx, endIdx + 1);
        }
      }
      
      // Strategy 3: Clean common issues
      jsonStr = jsonStr
        .replace(/,\s*}/g, '}')  // trailing commas before }
        .replace(/,\s*]/g, ']')  // trailing commas before ]
        .replace(/[\x00-\x1F\x7F]/g, ' '); // control characters
      
      analysis = JSON.parse(jsonStr);
      console.log('JSON parsed successfully');
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      console.error('Raw content preview:', content.substring(0, 500));
      return new Response(
        JSON.stringify({ error: 'Failed to parse AI response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate word count
    const wordCount = transcript.split(/\s+/).filter((word: string) => word.length > 0).length;

    // Build update data - only include title if none exists
    const updateData: Record<string, unknown> = {
      summary: analysis.summary,
      key_points: analysis.key_points || [],
      action_items: analysis.action_items || [],
      word_count: wordCount,
    };

    // Set title if current title is generic/missing and AI generated one
    if (needsTitle && analysis.title) {
      updateData.title = analysis.title;
      console.log(`Setting generated title: ${analysis.title} (replaced generic: "${recording.title || ''}")`);
    }

    // Update the recording with analysis results
    const { error: updateError } = await supabase
      .from('recordings')
      .update(updateData)
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
