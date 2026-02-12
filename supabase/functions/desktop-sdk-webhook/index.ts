import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RECALL_API_KEY = Deno.env.get("RECALL_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("[desktop-sdk-webhook] Received webhook:", JSON.stringify(body));

    const { event, data } = body;

    // Handle SDK upload complete event
    // See: https://docs.recall.ai/docs/desktop-sdk#webhooks
    if (event === "sdk_upload.complete") {
      console.log("[desktop-sdk-webhook] Processing sdk_upload.complete for recording:", data.recording_id);

      // Fetch recording details from Recall.ai API
      const recordingResponse = await fetch(
        `https://eu-central-1.recall.ai/api/v1/recording/${data.recording_id}`,
        {
          headers: {
            Authorization: `Token ${RECALL_API_KEY}`,
          },
        }
      );

      if (!recordingResponse.ok) {
        const errorText = await recordingResponse.text();
        console.error("[desktop-sdk-webhook] Failed to fetch recording:", errorText);
        return new Response(
          JSON.stringify({ error: "Failed to fetch recording details" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const recording = await recordingResponse.json();
      console.log("[desktop-sdk-webhook] Recording data:", JSON.stringify(recording).substring(0, 500));

      // Extract media URLs
      const videoUrl = recording.media_shortcuts?.video_mixed?.data?.download_url ||
                       recording.outputs?.video?.data?.download_url ||
                       null;
      const audioUrl = recording.media_shortcuts?.audio_mixed?.data?.download_url ||
                       recording.outputs?.audio?.data?.download_url ||
                       null;

      // Get user from SDK metadata if available
      const userId = data.user_id || data.metadata?.user_id || null;

      // Create Supabase client with service role
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // Insert or update recording in database
      const { error: dbError } = await supabase
        .from("recordings")
        .upsert({
          recall_id: data.recording_id,
          source: "desktop_sdk",
          status: "done",
          video_url: videoUrl,
          audio_url: audioUrl,
          title: recording.title || `Desktop-Aufnahme ${new Date().toLocaleDateString("de-DE")}`,
          duration: recording.duration || null,
          created_at: new Date().toISOString(),
          user_id: userId,
          // Store full metadata for debugging
          meeting_participants: recording.participants || null,
        }, {
          onConflict: "recall_id",
        });

      if (dbError) {
        console.error("[desktop-sdk-webhook] Database error:", dbError);
        return new Response(
          JSON.stringify({ error: "Failed to save recording" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("[desktop-sdk-webhook] Successfully saved desktop recording:", data.recording_id);

      // === TRANSKRIPT + ANALYSE PIPELINE ===
      const transcriptUrl = recording.media_shortcuts?.transcript?.data?.download_url || null;

      if (transcriptUrl) {
        console.log("[desktop-sdk-webhook] Transkript-URL gefunden, lade herunter...");
        try {
          const transcriptResponse = await fetch(transcriptUrl);
          if (transcriptResponse.ok) {
            const transcriptData = await transcriptResponse.json();
            console.log("[desktop-sdk-webhook] Transkript heruntergeladen, Segmente:", Array.isArray(transcriptData) ? transcriptData.length : 'unbekannt');

            // Format transcript segments to readable text
            let formattedTranscript = '';
            if (Array.isArray(transcriptData)) {
              let lastSpeaker = '';
              for (const seg of transcriptData) {
                const speaker = seg.speaker || 'Unbekannt';
                const text = (seg.words || []).map((w: { text: string }) => w.text).join(' ').trim();
                if (!text) continue;
                if (speaker !== lastSpeaker) {
                  if (formattedTranscript) formattedTranscript += '\n\n';
                  formattedTranscript += `${speaker}:\n${text}`;
                  lastSpeaker = speaker;
                } else {
                  formattedTranscript += ' ' + text;
                }
              }
            } else if (typeof transcriptData === 'string') {
              formattedTranscript = transcriptData;
            }

            if (formattedTranscript) {
              // Add Meeting-Info header
              let ownerEmail = 'Unbekannt';
              if (userId) {
                try {
                  const { data: userData } = await supabase.auth.admin.getUserById(userId);
                  ownerEmail = userData?.user?.email || 'Unbekannt';
                } catch (e) {
                  console.log('[desktop-sdk-webhook] Could not fetch owner email:', e);
                }
              }

              const transcriptHeader = `[Meeting-Info]\nUser-ID: ${userId || 'Unbekannt'}\nUser-Email: ${ownerEmail}\nRecording-ID: ${data.recording_id}\nErstellt: ${new Date().toISOString()}\n---\n\n`;
              const fullTranscript = transcriptHeader + formattedTranscript;

              // Fetch the recording row to get the DB id
              const { data: dbRecording } = await supabase
                .from("recordings")
                .select("id")
                .eq("recall_id", data.recording_id)
                .single();

              const recordingDbId = dbRecording?.id;

              if (recordingDbId) {
                // Save transcript to DB
                await supabase
                  .from("recordings")
                  .update({ transcript_text: fullTranscript, status: "done" })
                  .eq("id", recordingDbId);
                console.log("[desktop-sdk-webhook] Transkript in DB gespeichert");

                // Storage backup
                try {
                  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                  const fileName = `${userId || 'unknown'}/${recordingDbId}_${timestamp}.txt`;
                  const transcriptBlob = new Blob([fullTranscript], { type: 'text/plain' });
                  const transcriptArrayBuffer = await transcriptBlob.arrayBuffer();
                  const transcriptUint8Array = new Uint8Array(transcriptArrayBuffer);

                  const { error: uploadError } = await supabase.storage
                    .from('transcript-backups')
                    .upload(fileName, transcriptUint8Array, {
                      contentType: 'text/plain; charset=utf-8',
                      upsert: true,
                    });

                  if (uploadError) {
                    console.error('[desktop-sdk-webhook] Storage-Backup Fehler:', uploadError);
                  } else {
                    console.log('[desktop-sdk-webhook] Storage-Backup gespeichert:', fileName);
                  }
                } catch (backupErr) {
                  console.error('[desktop-sdk-webhook] Storage-Backup fehlgeschlagen:', backupErr);
                }

                // Trigger analyze-transcript
                try {
                  const analyzeResponse = await fetch(`${SUPABASE_URL}/functions/v1/analyze-transcript`, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ recording_id: recordingDbId }),
                  });
                  if (analyzeResponse.ok) {
                    console.log('[desktop-sdk-webhook] Analyse erfolgreich gestartet');
                  } else {
                    console.error('[desktop-sdk-webhook] Analyse fehlgeschlagen:', await analyzeResponse.text());
                  }
                } catch (analyzeErr) {
                  console.error('[desktop-sdk-webhook] Analyse-Fehler:', analyzeErr);
                }

                // External export
                const exportUrl = Deno.env.get('TRANSCRIPT_EXPORT_URL');
                const exportSecret = Deno.env.get('TRANSCRIPT_EXPORT_SECRET');
                if (exportUrl && exportSecret) {
                  try {
                    const meetingTitle = recording.title || `Desktop-Aufnahme ${new Date().toLocaleDateString("de-DE")}`;
                    const meetingDate = new Date().toLocaleString('de-DE', { dateStyle: 'full', timeStyle: 'short' });
                    const durationMinutes = recording.duration ? Math.round(recording.duration / 60) : null;

                    const txtContent = `========================================\nMEETING TRANSKRIPT\n========================================\nTitel: ${meetingTitle}\nDatum: ${meetingDate}\nDauer: ${durationMinutes ? durationMinutes + ' Minuten' : 'Unbekannt'}\nRecording ID: ${recordingDbId}\nUser ID: ${userId || 'Unbekannt'}\n========================================\n\n${fullTranscript}`;

                    const exportPayload = {
                      recording_id: recordingDbId,
                      user_id: userId,
                      title: meetingTitle,
                      safe_title: meetingTitle.replace(/[^a-zA-Z0-9äöüÄÖÜß\s-]/g, '').replace(/\s+/g, '_').substring(0, 100),
                      transcript_txt: txtContent,
                      created_at: new Date().toISOString(),
                      duration: recording.duration,
                      metadata: { summary: null, key_points: [], action_items: [], participants: recording.participants || [], word_count: null, video_url: videoUrl },
                    };

                    const exportResponse = await fetch(exportUrl, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'x-export-secret': exportSecret },
                      body: JSON.stringify(exportPayload),
                    });

                    if (exportResponse.ok) {
                      console.log('[desktop-sdk-webhook] Export erfolgreich');
                    } else {
                      console.error('[desktop-sdk-webhook] Export fehlgeschlagen:', exportResponse.status);
                    }
                  } catch (exportErr) {
                    console.error('[desktop-sdk-webhook] Export-Fehler:', exportErr);
                  }
                }
              }
            }
          } else {
            console.error('[desktop-sdk-webhook] Transkript-Download fehlgeschlagen:', transcriptResponse.status);
          }
        } catch (transcriptErr) {
          console.error('[desktop-sdk-webhook] Transkript-Abruf Fehler:', transcriptErr);
        }
      } else {
        // Kein Transkript vorhanden → automatisch Recall Async Transcription starten
        console.log("[desktop-sdk-webhook] Kein Transkript vorhanden, starte automatische Recall Async Transcription...");
        try {
          const autoTranscriptResponse = await fetch(
            `https://eu-central-1.recall.ai/api/v1/recording/${data.recording_id}/create_transcript/`,
            {
              method: "POST",
              headers: {
                Authorization: `Token ${RECALL_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                provider: { recallai_async: { language_code: "de" } },
              }),
            }
          );

          if (autoTranscriptResponse.ok) {
            console.log("[desktop-sdk-webhook] Async Transcription gestartet");
            // Update status to transcribing
            await supabase
              .from("recordings")
              .update({ status: "transcribing" })
              .eq("recall_id", data.recording_id);
            console.log("[desktop-sdk-webhook] Status auf 'transcribing' gesetzt");
          } else {
            const errText = await autoTranscriptResponse.text();
            console.error("[desktop-sdk-webhook] Async Transcription fehlgeschlagen:", autoTranscriptResponse.status, errText);
          }
        } catch (autoErr) {
          console.error("[desktop-sdk-webhook] Async Transcription Fehler:", autoErr);
        }
      }

      return new Response(
        JSON.stringify({ success: true, recording_id: data.recording_id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle other SDK events
    if (event === "sdk_upload.started") {
      console.log("[desktop-sdk-webhook] SDK upload started:", data.recording_id);
      return new Response(
        JSON.stringify({ success: true, message: "Upload started acknowledged" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (event === "sdk_upload.failed") {
      console.error("[desktop-sdk-webhook] SDK upload failed:", data);
      return new Response(
        JSON.stringify({ success: true, message: "Upload failure acknowledged" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Unknown event type
    console.log("[desktop-sdk-webhook] Unknown event type:", event);
    return new Response(
      JSON.stringify({ success: true, message: "Event received" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[desktop-sdk-webhook] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});