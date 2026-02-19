import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export function useQuickRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const displayStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const stopAllTracks = useCallback(() => {
    displayStreamRef.current?.getTracks().forEach(t => t.stop());
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    audioContextRef.current?.close().catch(() => {});
    displayStreamRef.current = null;
    micStreamRef.current = null;
    audioContextRef.current = null;
  }, []);

  const startRecording = useCallback(async () => {
    setError('');
    chunksRef.current = [];

    try {
      // Request screen (with system audio) and microphone simultaneously
      const [displayStream, micStream] = await Promise.all([
        navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }),
        navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        }),
      ]);

      displayStreamRef.current = displayStream;
      micStreamRef.current = micStream;

      // Combine audio tracks via AudioContext
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const destination = audioContext.createMediaStreamDestination();

      // Add mic audio
      const micSource = audioContext.createMediaStreamSource(micStream);
      micSource.connect(destination);

      // Add system audio if available
      const displayAudioTracks = displayStream.getAudioTracks();
      if (displayAudioTracks.length > 0) {
        const displayAudioStream = new MediaStream(displayAudioTracks);
        const displaySource = audioContext.createMediaStreamSource(displayAudioStream);
        displaySource.connect(destination);
      }

      // Build combined stream: video from display + merged audio
      const combinedStream = new MediaStream([
        ...displayStream.getVideoTracks(),
        ...destination.stream.getAudioTracks(),
      ]);

      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
          ? 'video/webm;codecs=vp9,opus'
          : 'video/webm',
      });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000);
      setIsRecording(true);

      // If user stops screen share via browser UI, auto-stop recording
      displayStream.getVideoTracks()[0]?.addEventListener('ended', () => {
        stopRecording();
      });

      toast({ title: '🔴 Aufnahme gestartet', description: 'Bildschirm und Mikrofon werden aufgenommen.' });
    } catch (err: any) {
      console.error('Quick recording start failed:', err);
      stopAllTracks();
      if (err.name !== 'NotAllowedError') {
        setError(err.message || 'Aufnahme konnte nicht gestartet werden.');
        toast({ title: 'Fehler', description: 'Aufnahme konnte nicht gestartet werden.', variant: 'destructive' });
      }
    }
  }, [stopAllTracks]);

  const stopRecording = useCallback(async () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;

    return new Promise<void>((resolve) => {
      const recorder = mediaRecorderRef.current!;
      recorder.onstop = async () => {
        setIsRecording(false);
        stopAllTracks();

        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        chunksRef.current = [];

        if (blob.size === 0) {
          toast({ title: 'Fehler', description: 'Keine Aufnahmedaten vorhanden.', variant: 'destructive' });
          resolve();
          return;
        }

        toast({ title: 'Aufnahme beendet', description: 'Wird hochgeladen und transkribiert…' });

        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            toast({ title: 'Fehler', description: 'Nicht eingeloggt.', variant: 'destructive' });
            resolve();
            return;
          }

          const now = new Date();
          const title = `Aufnahme ${now.toLocaleDateString('de-DE')} ${now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;

          const formData = new FormData();
          formData.append('audio', blob, `recording-${Date.now()}.webm`);
          formData.append('title', title);

          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          const response = await fetch(`${supabaseUrl}/functions/v1/transcribe-audio`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.access_token}` },
            body: formData,
          });

          const result = await response.json();

          if (response.ok && result.success) {
            toast({ title: '✅ Aufnahme gespeichert', description: 'Die Transkription läuft im Hintergrund.' });
          } else {
            toast({ title: 'Fehler', description: result.error || 'Upload fehlgeschlagen.', variant: 'destructive' });
          }
        } catch (uploadErr: any) {
          console.error('Upload failed:', uploadErr);
          toast({ title: 'Fehler', description: 'Upload fehlgeschlagen.', variant: 'destructive' });
        }
        resolve();
      };

      recorder.stop();
    });
  }, [stopAllTracks]);

  return { isRecording, startRecording, stopRecording, error };
}
