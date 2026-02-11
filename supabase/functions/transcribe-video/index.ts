import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function processVideoTranscription(
  recordingId: string,
  userId: string,
  videoUrl: string,
  recordingTitle: string,
) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const elevenLabsKey = Deno.env.get('ELEVENLABS_API_KEY')!;
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  // Save previous status so we can restore on hard crash recovery
  const { data: prevRec } = await supabaseAdmin.from('recordings').select('status').eq('id', recordingId).single();
  const previousStatus = prevRec?.status || 'done';

  try {
    console.log(`Downloading video from: ${videoUrl}`);
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      throw new Error(`Video download failed: ${videoResponse.status}`);
    }

    const videoBlob = await videoResponse.blob();
    const sizeMB = videoBlob.size / 1024 / 1024;
    console.log(`Video downloaded: ${sizeMB.toFixed(1)} MB`);

    // Reject files too large for edge function processing
    if (sizeMB > 500) {
      throw new Error(`Video too large (${sizeMB.toFixed(0)} MB). Max 500 MB for edge function processing.`);
    }

    // Only set transcribing AFTER successful download to avoid stuck state on hard crash
    await supabaseAdmin.from('recordings').update({ status: 'transcribing' }).eq('id', recordingId);

    // Transcribe with ElevenLabs
    console.log('Starting ElevenLabs transcription...');
    const elevenLabsFormData = new FormData();
    elevenLabsFormData.append('file', videoBlob, 'video.mp4');
    elevenLabsFormData.append('model_id', 'scribe_v2');
    elevenLabsFormData.append('diarize', 'true');
    elevenLabsFormData.append('language_code', 'deu');
    elevenLabsFormData.append('tag_audio_events', 'true');

    const transcribeResponse = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: { 'xi-api-key': elevenLabsKey },
      body: elevenLabsFormData,
    });

    if (!transcribeResponse.ok) {
      const errorText = await transcribeResponse.text();
      throw new Error(`ElevenLabs error: ${transcribeResponse.status} - ${errorText}`);
    }

    const transcription = await transcribeResponse.json();
    console.log('Transcription completed, processing results...');

    // Format transcript
    let formattedTranscript = '';
    let currentSpeaker = '';
    let wordCount = 0;
    let duration = 0;

    if (transcription.words && transcription.words.length > 0) {
      duration = transcription.words[transcription.words.length - 1].end || 0;
      for (const word of transcription.words) {
        wordCount++;
        const speaker = word.speaker || 'Unbekannt';
        if (speaker !== currentSpeaker) {
          if (formattedTranscript) formattedTranscript += '\n\n';
          formattedTranscript += `${speaker}: `;
          currentSpeaker = speaker;
        }
        formattedTranscript += word.text + ' ';
      }
    } else {
      formattedTranscript = transcription.text || '';
      wordCount = formattedTranscript.split(/\s+/).filter(Boolean).length;
    }

    // Extract speakers
    const speakers = new Set<string>();
    if (transcription.words) {
      for (const word of transcription.words) {
        if (word.speaker) speakers.add(word.speaker);
      }
    }
    const participants = Array.from(speakers).map((name, index) => ({ id: index + 1, name }));

    const meetingTitle = recordingTitle || 'Video-Transkription';
    const transcriptWithHeader = `[Meeting-Info]\nUser-ID: ${userId}\nRecording-ID: ${recordingId}\nSource: video-transcription\nErstellt: ${new Date().toISOString()}\n---\n\n${formattedTranscript.trim()}`;

    // Update recording
    await supabaseAdmin.from('recordings').update({
      transcript_text: transcriptWithHeader,
      status: 'done',
      duration: Math.round(duration),
      word_count: wordCount,
      participants: participants.length > 0 ? participants : null,
    }).eq('id', recordingId);

    console.log(`Recording ${recordingId} transcribed. Duration: ${Math.round(duration)}s, Words: ${wordCount}`);

    // Backup
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await supabaseAdmin.storage.from('transcript-backups').upload(
      `${userId}/${recordingId}_video_${timestamp}.txt`,
      new TextEncoder().encode(transcriptWithHeader),
      { contentType: 'text/plain; charset=utf-8', upsert: true }
    );

    // Trigger AI analysis
    try {
      const analyzeResponse = await fetch(`${supabaseUrl}/functions/v1/analyze-transcript`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
        body: JSON.stringify({ recording_id: recordingId }),
      });
      if (!analyzeResponse.ok) console.warn('AI analysis failed:', await analyzeResponse.text());
      else console.log('AI analysis triggered successfully');
    } catch (e) { console.warn('Failed to trigger AI analysis:', e); }

    // Export
    const exportUrl = Deno.env.get('TRANSCRIPT_EXPORT_URL');
    const exportSecret = Deno.env.get('TRANSCRIPT_EXPORT_SECRET');
    if (exportUrl && exportSecret) {
      try {
        const safeTitle = meetingTitle.replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue').replace(/[ß]/g, 'ss').replace(/[^a-zA-Z0-9\s\-_]/g, '').replace(/\s+/g, '_').substring(0, 50);
        const txtContent = `========================================\nMEETING TRANSKRIPT\n========================================\nTitel: ${meetingTitle}\nDatum: ${new Date().toLocaleString('de-DE')}\nDauer: ${Math.round(duration / 60)} Minuten\nRecording ID: ${recordingId}\nSource: Video Transcription\n========================================\n\n${formattedTranscript.trim()}`;
        await fetch(exportUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-export-secret': exportSecret },
          body: JSON.stringify({ recording_id: recordingId, user_id: userId, title: meetingTitle, safe_title: safeTitle, transcript_txt: txtContent, created_at: new Date().toISOString(), duration: Math.round(duration), metadata: { source: 'video-transcription', word_count: wordCount, speaker_count: participants.length } }),
        });
      } catch (e) { console.warn('Export error:', e); }
    }

  } catch (error) {
    console.error(`Transcription failed for ${recordingId}:`, error);
    await createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
      .from('recordings').update({ status: 'error' }).eq('id', recordingId);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    if (!Deno.env.get('ELEVENLABS_API_KEY')) {
      return new Response(JSON.stringify({ error: 'ElevenLabs API key not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { recording_id } = await req.json();
    if (!recording_id) {
      return new Response(JSON.stringify({ error: 'recording_id is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: recording, error: fetchError } = await supabaseAdmin.from('recordings').select('*').eq('id', recording_id).single();
    if (fetchError || !recording) {
      return new Response(JSON.stringify({ error: 'Recording not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Check ownership or admin
    const isOwner = recording.user_id === user.id;
    if (!isOwner) {
      const { data: adminRole } = await supabaseAdmin.from('user_roles').select('id').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
      if (!adminRole) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    if (!recording.video_url) {
      return new Response(JSON.stringify({ error: 'No video URL available' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Warn about long recordings that may exceed edge function limits
    if (recording.duration && recording.duration > 3600) {
      console.warn(`Recording ${recording_id} is ${Math.round(recording.duration / 60)} min long - may exceed edge function limits`);
    }

    // Run in background with waitUntil
    EdgeRuntime.waitUntil(
      processVideoTranscription(recording_id, recording.user_id, recording.video_url, recording.title || '')
    );

    // Return immediately
    return new Response(JSON.stringify({ success: true, message: 'Transcription started in background', recordingId: recording_id }), {
      status: 202,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Transcription error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
