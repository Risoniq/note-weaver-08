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
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
      return new Response(
        JSON.stringify({ error: 'recording_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Analyzing transcript for recording: ${recording_id}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: recording, error: fetchError } = await supabase
      .from('recordings')
      .select('transcript_text, title, user_id')
      .eq('id', recording_id)
      .single();

    if (fetchError || !recording) {
      return new Response(
        JSON.stringify({ error: 'Recording not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!isServiceRole && recording.user_id && recording.user_id !== user.id) {
      const { data: adminCheck } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
      
      if (!adminCheck) {
        return new Response(
          JSON.stringify({ error: 'Access denied' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (!recording.transcript_text) {
      return new Response(
        JSON.stringify({ error: 'No transcript available' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const transcript = recording.transcript_text;
    console.log(`Transcript length: ${transcript.length} characters`);

    const isGenericTitle = (title: string | null): boolean => {
      if (!title || title.trim() === '') return true;
      const t = title.trim().toLowerCase();
      const genericTerms = ['meeting', 'besprechung', 'untitled', 'aufnahme', 'recording', 'call', 'anruf', 'konferenz', 'conference', 'session', 'notetaker', 'note taker', 'bot'];
      if (genericTerms.some(term => t === term)) return true;
      if (genericTerms.some(term => t.startsWith(term) && /^[\s\d\-_.:]+$/.test(t.slice(term.length)))) return true;
      if (/^[0-9a-f]{8,}/i.test(t)) return true;
      if (t.length <= 3) return true;
      return false;
    };

    const needsTitle = isGenericTitle(recording.title);

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
- Übernimm NIEMALS Schimpfwörter, Beleidigungen oder unangemessene Sprache - formuliere diese neutral um
- Übernimm NIEMALS Passwörter, Zugangsdaten oder sensible Informationen - ersetze diese durch "[ENTFERNT]"
- Halte den Ton sachlich und respektvoll

Antworte NUR im folgenden JSON-Format, ohne zusätzlichen Text:
${jsonFormat}`;

    console.log('Calling Anthropic API for analysis...');
    
    const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          { role: 'user', content: `Analysiere dieses Meeting-Transkript:\n\n${transcript}` }
        ],
      }),
    });

    if (!aiResponse.ok) {
      console.error('[Internal] Anthropic API error:', aiResponse.status);
      
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
    const content = aiData.content?.[0]?.text;
    
    if (!content) {
      console.error('No content in Anthropic response');
      return new Response(
        JSON.stringify({ error: 'Empty AI response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('AI Response received, length:', content.length);

    // Robust JSON extraction
    let analysis;
    try {
      let jsonStr = content;
      jsonStr = jsonStr.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      
      if (!jsonStr.startsWith('{')) {
        const startIdx = jsonStr.indexOf('{');
        const endIdx = jsonStr.lastIndexOf('}');
        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
          jsonStr = jsonStr.slice(startIdx, endIdx + 1);
        }
      }
      
      jsonStr = jsonStr
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']')
        .replace(/[\x00-\x1F\x7F]/g, ' ');
      
      analysis = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      return new Response(
        JSON.stringify({ error: 'Failed to parse AI response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const wordCount = transcript.split(/\s+/).filter((word: string) => word.length > 0).length;

    const updateData: Record<string, unknown> = {
      summary: analysis.summary,
      key_points: analysis.key_points || [],
      action_items: analysis.action_items || [],
      word_count: wordCount,
    };

    if (needsTitle && analysis.title) {
      updateData.title = analysis.title;
      console.log(`Setting generated title: ${analysis.title}`);
    }

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
