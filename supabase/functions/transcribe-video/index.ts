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
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const elevenLabsKey = Deno.env.get('ELEVENLABS_API_KEY');

    if (!elevenLabsKey) {
      return new Response(JSON.stringify({ error: 'ElevenLabs API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user auth
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { recording_id } = await req.json();
    if (!recording_id) {
      return new Response(JSON.stringify({ error: 'recording_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch recording and verify ownership
    const { data: recording, error: fetchError } = await supabaseAdmin
      .from('recordings')
      .select('*')
      .eq('id', recording_id)
      .single();

    if (fetchError || !recording) {
      return new Response(JSON.stringify({ error: 'Recording not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check ownership or admin role
    const isOwner = recording.user_id === user.id;
    let isAdmin = false;
    if (!isOwner) {
      const { data: adminRole } = await supabaseAdmin
        .from('user_roles')
        .select('id')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
      isAdmin = !!adminRole;
    }

    if (!isOwner && !isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!recording.video_url) {
      return new Response(JSON.stringify({ error: 'No video URL available' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update status to transcribing
    await supabaseAdmin
      .from('recordings')
      .update({ status: 'transcribing' })
      .eq('id', recording_id);

    console.log(`Downloading video from: ${recording.video_url}`);

    // Download video
    const videoResponse = await fetch(recording.video_url);
    if (!videoResponse.ok) {
      console.error('Video download failed:', videoResponse.status);
      await supabaseAdmin.from('recordings').update({ status: 'error' }).eq('id', recording_id);
      return new Response(JSON.stringify({ error: 'Failed to download video' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const videoBlob = await videoResponse.blob();
    console.log(`Video downloaded: ${(videoBlob.size / 1024 / 1024).toFixed(1)} MB`);

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
      console.error('ElevenLabs transcription error:', errorText);
      await supabaseAdmin.from('recordings').update({ status: 'error' }).eq('id', recording_id);
      return new Response(JSON.stringify({ error: 'Transcription failed', details: errorText }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const transcription = await transcribeResponse.json();
    console.log('Transcription completed, processing results...');

    // Format transcript with speaker labels
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

    // Extract unique speakers
    const speakers = new Set<string>();
    if (transcription.words) {
      for (const word of transcription.words) {
        if (word.speaker) speakers.add(word.speaker);
      }
    }

    const participants = Array.from(speakers).map((name, index) => ({
      id: index + 1,
      name,
    }));

    // Prepare transcript with metadata header
    const meetingTitle = recording.title || 'Video-Transkription';
    const transcriptWithHeader = `[Meeting-Info]
User-ID: ${user.id}
Recording-ID: ${recording_id}
Source: video-transcription
Erstellt: ${new Date().toISOString()}
---

${formattedTranscript.trim()}`;

    // Update recording
    await supabaseAdmin
      .from('recordings')
      .update({
        transcript_text: transcriptWithHeader,
        status: 'done',
        duration: Math.round(duration),
        word_count: wordCount,
        participants: participants.length > 0 ? participants : null,
      })
      .eq('id', recording_id);

    console.log(`Recording ${recording_id} transcribed. Duration: ${Math.round(duration)}s, Words: ${wordCount}`);

    // Save transcript backup
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `${user.id}/${recording_id}_video_${timestamp}.txt`;

    const { error: backupError } = await supabaseAdmin.storage
      .from('transcript-backups')
      .upload(backupFileName, new TextEncoder().encode(transcriptWithHeader), {
        contentType: 'text/plain; charset=utf-8',
        upsert: true,
      });

    if (backupError) {
      console.warn('Backup upload failed:', backupError);
    }

    // Trigger AI analysis
    try {
      const analyzeResponse = await fetch(`${supabaseUrl}/functions/v1/analyze-transcript`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ recording_id }),
      });

      if (!analyzeResponse.ok) {
        console.warn('AI analysis trigger failed:', await analyzeResponse.text());
      } else {
        console.log('AI analysis triggered successfully');
      }
    } catch (analyzeError) {
      console.warn('Failed to trigger AI analysis:', analyzeError);
    }

    // Export to external system
    const exportUrl = Deno.env.get('TRANSCRIPT_EXPORT_URL');
    const exportSecret = Deno.env.get('TRANSCRIPT_EXPORT_SECRET');

    if (exportUrl && exportSecret) {
      try {
        const safeTitle = meetingTitle
          .replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe')
          .replace(/[üÜ]/g, 'ue').replace(/[ß]/g, 'ss')
          .replace(/[^a-zA-Z0-9\s\-_]/g, '').replace(/\s+/g, '_')
          .substring(0, 50);

        const txtContent = `========================================
MEETING TRANSKRIPT
========================================
Titel: ${meetingTitle}
Datum: ${new Date().toLocaleString('de-DE')}
Dauer: ${Math.round(duration / 60)} Minuten
Recording ID: ${recording_id}
User ID: ${user.id}
Source: Video Transcription
========================================

${formattedTranscript.trim()}`;

        await fetch(exportUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-export-secret': exportSecret,
          },
          body: JSON.stringify({
            recording_id,
            user_id: user.id,
            title: meetingTitle,
            safe_title: safeTitle,
            transcript_txt: txtContent,
            created_at: new Date().toISOString(),
            duration: Math.round(duration),
            metadata: {
              source: 'video-transcription',
              word_count: wordCount,
              speaker_count: participants.length,
            },
          }),
        });
      } catch (exportError) {
        console.warn('Export error:', exportError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      recordingId: recording_id,
      duration: Math.round(duration),
      wordCount,
      speakerCount: participants.length,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Transcription error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
