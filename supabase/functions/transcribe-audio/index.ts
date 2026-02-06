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

    // Parse multipart form data
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File | null;
    const title = formData.get('title') as string | null;

    if (!audioFile) {
      return new Response(JSON.stringify({ error: 'No audio file provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing audio file: ${audioFile.name}, size: ${audioFile.size} bytes`);

    // Upload to Supabase Storage first
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const fileExt = audioFile.name.split('.').pop() || 'mp3';
    const storagePath = `${user.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('audio-uploads')
      .upload(storagePath, audioFile, {
        contentType: audioFile.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return new Response(JSON.stringify({ error: 'Failed to upload audio file' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create recording entry
    const meetingId = `manual_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const { data: recording, error: recordingError } = await supabaseAdmin
      .from('recordings')
      .insert({
        meeting_id: meetingId,
        user_id: user.id,
        title: title || audioFile.name.replace(/\.[^/.]+$/, ''),
        status: 'transcribing',
        source: 'manual',
      })
      .select()
      .single();

    if (recordingError) {
      console.error('Recording insert error:', recordingError);
      return new Response(JSON.stringify({ error: 'Failed to create recording' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Transcribe with ElevenLabs
    console.log('Starting ElevenLabs transcription...');
    
    const elevenLabsFormData = new FormData();
    elevenLabsFormData.append('file', audioFile);
    elevenLabsFormData.append('model_id', 'scribe_v2');
    elevenLabsFormData.append('diarize', 'true');
    elevenLabsFormData.append('tag_audio_events', 'true');

    const transcribeResponse = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: {
        'xi-api-key': elevenLabsKey,
      },
      body: elevenLabsFormData,
    });

    if (!transcribeResponse.ok) {
      const errorText = await transcribeResponse.text();
      console.error('ElevenLabs transcription error:', errorText);
      
      await supabaseAdmin
        .from('recordings')
        .update({ status: 'error' })
        .eq('id', recording.id);

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
        const speaker = word.speaker || 'Speaker';
        
        if (speaker !== currentSpeaker) {
          if (formattedTranscript) formattedTranscript += '\n\n';
          formattedTranscript += `**${speaker}:** `;
          currentSpeaker = speaker;
        }
        formattedTranscript += word.text + ' ';
      }
    } else {
      formattedTranscript = transcription.text || '';
      wordCount = formattedTranscript.split(/\s+/).filter(Boolean).length;
    }

    // Extract unique speakers for participants
    const speakers = new Set<string>();
    if (transcription.words) {
      for (const word of transcription.words) {
        if (word.speaker) {
          speakers.add(word.speaker);
        }
      }
    }

    const participants = Array.from(speakers).map((name, index) => ({
      id: index + 1,
      name,
    }));

    // Prepare transcript with metadata header (consistent with bot recordings)
    const meetingTitle = title || audioFile.name.replace(/\.[^/.]+$/, '');
    const transcriptWithHeader = `[Meeting-Info]
User-ID: ${user.id}
Recording-ID: ${recording.id}
Source: manual
Erstellt: ${new Date().toISOString()}
---

${formattedTranscript.trim()}`;

    // Update recording with transcript
    await supabaseAdmin
      .from('recordings')
      .update({
        transcript_text: transcriptWithHeader,
        status: 'done',
        duration: Math.round(duration),
        word_count: wordCount,
        participants: participants.length > 0 ? participants : null,
      })
      .eq('id', recording.id);

    console.log(`Recording ${recording.id} completed. Duration: ${duration}s, Words: ${wordCount}`);

    // Save transcript backup to storage
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `${user.id}/${recording.id}_${timestamp}.txt`;

    const { error: backupError } = await supabaseAdmin.storage
      .from('transcript-backups')
      .upload(backupFileName, new TextEncoder().encode(transcriptWithHeader), {
        contentType: 'text/plain; charset=utf-8',
        upsert: true
      });

    if (backupError) {
      console.warn('Backup upload failed:', backupError);
    } else {
      console.log('Transcript backup saved:', backupFileName);
    }

    // Trigger AI analysis
    try {
      const analyzeResponse = await fetch(`${supabaseUrl}/functions/v1/analyze-transcript`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ recording_id: recording.id }),
      });
      
      if (!analyzeResponse.ok) {
        console.warn('AI analysis trigger failed:', await analyzeResponse.text());
      } else {
        console.log('AI analysis triggered successfully');
      }
    } catch (analyzeError) {
      console.warn('Failed to trigger AI analysis:', analyzeError);
    }

    // Export to external system (consistent with bot recordings)
    const exportUrl = Deno.env.get('TRANSCRIPT_EXPORT_URL');
    const exportSecret = Deno.env.get('TRANSCRIPT_EXPORT_SECRET');

    if (exportUrl && exportSecret) {
      console.log('Exporting transcript to external system...');
      try {
        const safeTitle = meetingTitle
          .replace(/[äÄ]/g, 'ae')
          .replace(/[öÖ]/g, 'oe')
          .replace(/[üÜ]/g, 'ue')
          .replace(/[ß]/g, 'ss')
          .replace(/[^a-zA-Z0-9\s\-_]/g, '')
          .replace(/\s+/g, '_')
          .substring(0, 50);
        
        const txtContent = `========================================
MEETING TRANSKRIPT
========================================
Titel: ${meetingTitle}
Datum: ${new Date().toLocaleString('de-DE')}
Dauer: ${Math.round(duration / 60)} Minuten
Recording ID: ${recording.id}
User ID: ${user.id}
Source: Manual Upload
========================================

${formattedTranscript.trim()}`;

        const exportPayload = {
          recording_id: recording.id,
          user_id: user.id,
          title: meetingTitle,
          safe_title: safeTitle,
          transcript_txt: txtContent,
          created_at: new Date().toISOString(),
          duration: Math.round(duration),
          metadata: {
            source: 'manual',
            word_count: wordCount,
            speaker_count: participants.length,
          }
        };

        const exportResponse = await fetch(exportUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-export-secret': exportSecret,
          },
          body: JSON.stringify(exportPayload),
        });

        if (exportResponse.ok) {
          console.log('External export successful');
        } else {
          console.warn('External export failed:', await exportResponse.text());
        }
      } catch (exportError) {
        console.warn('Export error:', exportError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      recordingId: recording.id,
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
