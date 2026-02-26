import { createContext, useContext, useState, useRef, useCallback, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';


const MAX_CHUNK_BYTES = 750 * 1024 * 1024;

type RecordingMode = 'monitor' | 'window' | 'browser';

interface QuickRecordingContextValue {
  isRecording: boolean;
  recordingMode: RecordingMode | null;
  elapsedSeconds: number;
  showModeDialog: boolean;
  setShowModeDialog: (v: boolean) => void;
  openModeDialog: () => void;
  startRecording: (mode: RecordingMode) => Promise<void>;
  stopRecording: () => Promise<void>;
  error: string;
}

const QuickRecordingContext = createContext<QuickRecordingContextValue | null>(null);

export function useQuickRecordingContext() {
  const ctx = useContext(QuickRecordingContext);
  if (!ctx) throw new Error('useQuickRecordingContext must be inside QuickRecordingProvider');
  return ctx;
}

interface Props {
  children: ReactNode;
}

export function QuickRecordingProvider({ children }: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingMode, setRecordingMode] = useState<RecordingMode | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showModeDialog, setShowModeDialog] = useState(false);
  const [error, setError] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const totalChunkSizeRef = useRef(0);
  const displayStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isStoppingRef = useRef(false);

  const stopAllTracks = useCallback(() => {
    displayStreamRef.current?.getTracks().forEach(t => t.stop());
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    audioContextRef.current?.close().catch(() => {});
    displayStreamRef.current = null;
    micStreamRef.current = null;
    audioContextRef.current = null;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const openModeDialog = useCallback(() => {
    setShowModeDialog(true);
  }, []);

  const startRecording = useCallback(async (mode: RecordingMode) => {
    setError('');
    setShowModeDialog(false);
    chunksRef.current = [];
    totalChunkSizeRef.current = 0;
    isStoppingRef.current = false;

    try {
      const displayConstraints: any = { video: { displaySurface: mode }, audio: true };
      const [displayStream, micStream] = await Promise.all([
        navigator.mediaDevices.getDisplayMedia(displayConstraints),
        navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }),
      ]);

      displayStreamRef.current = displayStream;
      micStreamRef.current = micStream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const destination = audioContext.createMediaStreamDestination();
      const micSource = audioContext.createMediaStreamSource(micStream);
      micSource.connect(destination);

      const displayAudioTracks = displayStream.getAudioTracks();
      if (displayAudioTracks.length > 0) {
        const displaySource = audioContext.createMediaStreamSource(new MediaStream(displayAudioTracks));
        displaySource.connect(destination);
      }

      const combinedStream = new MediaStream([
        ...displayStream.getVideoTracks(),
        ...destination.stream.getAudioTracks(),
      ]);

      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
          ? 'video/webm;codecs=vp9,opus' : 'video/webm',
      });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
          totalChunkSizeRef.current += e.data.size;
          if (totalChunkSizeRef.current >= MAX_CHUNK_BYTES) {
            toast({ title: 'Speicherlimit erreicht', description: 'Aufnahme automatisch beendet (750 MB).', variant: 'destructive' });
            stopRecording();
          }
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingMode(mode);
      setElapsedSeconds(0);

      timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);

      displayStream.getVideoTracks()[0]?.addEventListener('ended', () => { stopRecording(); });

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
    if (isStoppingRef.current) return;
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;
    isStoppingRef.current = true;

    return new Promise<void>((resolve) => {
      const recorder = mediaRecorderRef.current!;
      recorder.onstop = async () => {
        setIsRecording(false);
        setRecordingMode(null);
        setElapsedSeconds(0);
        stopAllTracks();

        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        chunksRef.current = [];

        if (blob.size === 0) {
          toast({ title: 'Fehler', description: 'Keine Aufnahmedaten vorhanden.', variant: 'destructive' });
          isStoppingRef.current = false;
          resolve();
          return;
        }

        toast({ title: 'Aufnahme beendet', description: 'Wird hochgeladen und transkribiert…' });

        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            toast({ title: 'Fehler', description: 'Nicht eingeloggt.', variant: 'destructive' });
            isStoppingRef.current = false;
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
        isStoppingRef.current = false;
        resolve();
      };
      recorder.stop();
    });
  }, [stopAllTracks]);

  // beforeunload protection
  useEffect(() => {
    if (!isRecording) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isRecording]);

  return (
    <QuickRecordingContext.Provider value={{
      isRecording, recordingMode, elapsedSeconds, showModeDialog, setShowModeDialog,
      openModeDialog, startRecording, stopRecording, error,
    }}>
      {children}
    </QuickRecordingContext.Provider>
  );
}
