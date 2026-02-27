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
  startRecording: (mode: RecordingMode, withWebcam?: boolean) => Promise<void>;
  stopRecording: () => Promise<void>;
  error: string;
  includeWebcam: boolean;
  webcamStream: MediaStream | null;
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
  const [includeWebcam, setIncludeWebcam] = useState(false);
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const totalChunkSizeRef = useRef(0);
  const displayStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const webcamStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isStoppingRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pipVideoRef = useRef<HTMLVideoElement | null>(null);
  const recordingModeRef = useRef<RecordingMode | null>(null);
  const isRecordingRef = useRef(false);

  const stopAllTracks = useCallback(() => {
    displayStreamRef.current?.getTracks().forEach(t => t.stop());
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    webcamStreamRef.current?.getTracks().forEach(t => t.stop());
    audioContextRef.current?.close().catch(() => {});
    displayStreamRef.current = null;
    micStreamRef.current = null;
    webcamStreamRef.current = null;
    audioContextRef.current = null;
    setWebcamStream(null);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (canvasIntervalRef.current) { clearInterval(canvasIntervalRef.current); canvasIntervalRef.current = null; }
    canvasRef.current = null;
    // Close PiP
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(() => {});
    }
    if (pipVideoRef.current) {
      pipVideoRef.current.srcObject = null;
      pipVideoRef.current = null;
    }
  }, []);

  const openModeDialog = useCallback(() => {
    setShowModeDialog(true);
  }, []);

  const startRecording = useCallback(async (mode: RecordingMode, withWebcam = false) => {
    setError('');
    setShowModeDialog(false);
    chunksRef.current = [];
    totalChunkSizeRef.current = 0;
    isStoppingRef.current = false;
    setIncludeWebcam(withWebcam);

    try {
      const displayConstraints: any = { video: { displaySurface: mode }, audio: true };
      const [displayStream, micStream] = await Promise.all([
        navigator.mediaDevices.getDisplayMedia(displayConstraints),
        navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }),
      ]);

      displayStreamRef.current = displayStream;
      micStreamRef.current = micStream;

      // Audio mixing
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

      // Determine video track(s)
      let videoTracks: MediaStreamTrack[];

      if (withWebcam) {
        // Get webcam stream
        const camStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, facingMode: 'user' },
        });
        webcamStreamRef.current = camStream;
        setWebcamStream(camStream);

        // Set up canvas compositing
        const displayVideoTrack = displayStream.getVideoTracks()[0];
        const displaySettings = displayVideoTrack.getSettings();
        const cw = displaySettings.width || 1920;
        const ch = displaySettings.height || 1080;

        const canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        canvasRef.current = canvas;
        const ctx2d = canvas.getContext('2d')!;

        const displayVideo = document.createElement('video');
        displayVideo.srcObject = new MediaStream([displayVideoTrack]);
        displayVideo.muted = true;
        displayVideo.playsInline = true;
        displayVideo.play().catch(() => {});

        const camVideo = document.createElement('video');
        camVideo.srcObject = camStream;
        camVideo.muted = true;
        camVideo.playsInline = true;
        camVideo.play().catch(() => {});

        const overlayW = 200;
        const overlayH = 150;
        const padding = 20;

        const drawFrame = () => {
          ctx2d.drawImage(displayVideo, 0, 0, cw, ch);
          // Draw webcam overlay bottom-right with rounded rect clip
          const ox = cw - overlayW - padding;
          const oy = ch - overlayH - padding;
          const radius = 12;
          ctx2d.save();
          ctx2d.beginPath();
          ctx2d.moveTo(ox + radius, oy);
          ctx2d.lineTo(ox + overlayW - radius, oy);
          ctx2d.quadraticCurveTo(ox + overlayW, oy, ox + overlayW, oy + radius);
          ctx2d.lineTo(ox + overlayW, oy + overlayH - radius);
          ctx2d.quadraticCurveTo(ox + overlayW, oy + overlayH, ox + overlayW - radius, oy + overlayH);
          ctx2d.lineTo(ox + radius, oy + overlayH);
          ctx2d.quadraticCurveTo(ox, oy + overlayH, ox, oy + overlayH - radius);
          ctx2d.lineTo(ox, oy + radius);
          ctx2d.quadraticCurveTo(ox, oy, ox + radius, oy);
          ctx2d.closePath();
          ctx2d.clip();
          ctx2d.drawImage(camVideo, ox, oy, overlayW, overlayH);
          ctx2d.restore();
          // Border
          ctx2d.strokeStyle = 'rgba(255,255,255,0.6)';
          ctx2d.lineWidth = 2;
          ctx2d.beginPath();
          ctx2d.moveTo(ox + radius, oy);
          ctx2d.lineTo(ox + overlayW - radius, oy);
          ctx2d.quadraticCurveTo(ox + overlayW, oy, ox + overlayW, oy + radius);
          ctx2d.lineTo(ox + overlayW, oy + overlayH - radius);
          ctx2d.quadraticCurveTo(ox + overlayW, oy + overlayH, ox + overlayW - radius, oy + overlayH);
          ctx2d.lineTo(ox + radius, oy + overlayH);
          ctx2d.quadraticCurveTo(ox, oy + overlayH, ox, oy + overlayH - radius);
          ctx2d.lineTo(ox, oy + radius);
          ctx2d.quadraticCurveTo(ox, oy, ox + radius, oy);
          ctx2d.closePath();
          ctx2d.stroke();

          animFrameRef.current = requestAnimationFrame(drawFrame);
        };
        animFrameRef.current = requestAnimationFrame(drawFrame);

        const canvasStream = canvas.captureStream(30);
        videoTracks = canvasStream.getVideoTracks();
      } else {
        videoTracks = displayStream.getVideoTracks();
      }

      const combinedStream = new MediaStream([
        ...videoTracks,
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
            toast({ title: 'Speicherlimit erreicht', description: 'Aufnahme automatisch beendet (750 MB).', variant: 'destructive', id: 'recording-limit' });
            stopRecording();
          }
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000);
      setIsRecording(true);
      isRecordingRef.current = true;
      setRecordingMode(mode);
      recordingModeRef.current = mode;
      setElapsedSeconds(0);

      timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);

      displayStream.getVideoTracks()[0]?.addEventListener('ended', () => { stopRecording(); });

      // Set up PiP video element for monitor mode
      if (mode === 'monitor' && 'pictureInPictureEnabled' in document) {
        const pipVideo = document.createElement('video');
        pipVideo.srcObject = displayStream;
        pipVideo.muted = true;
        pipVideo.playsInline = true;
        pipVideo.play().catch(() => {});
        pipVideoRef.current = pipVideo;
      }

      toast({ title: '🔴 Aufnahme gestartet', description: 'Bildschirm und Mikrofon werden aufgenommen.', id: 'recording-start' });
    } catch (err: any) {
      console.error('Quick recording start failed:', err);
      stopAllTracks();
      setIncludeWebcam(false);
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
        isRecordingRef.current = false;
        setRecordingMode(null);
        recordingModeRef.current = null;
        setElapsedSeconds(0);
        setIncludeWebcam(false);
        stopAllTracks();

        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        chunksRef.current = [];

        if (blob.size === 0) {
          toast({ title: 'Fehler', description: 'Keine Aufnahmedaten vorhanden.', variant: 'destructive' });
          isStoppingRef.current = false;
          resolve();
          return;
        }

        toast({ title: 'Aufnahme beendet', description: 'Wird hochgeladen und transkribiert…', id: 'recording-stop' });

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
            toast({ title: '✅ Aufnahme gespeichert', description: 'Die Transkription läuft im Hintergrund.', id: 'recording-saved' });
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

  // PiP visibility change handler
  useEffect(() => {
    const handler = () => {
      if (!isRecordingRef.current || recordingModeRef.current !== 'monitor') return;
      const pipVideo = pipVideoRef.current;
      if (!pipVideo) return;

      if (document.hidden) {
        pipVideo.requestPictureInPicture().catch(() => {});
      } else if (document.pictureInPictureElement) {
        document.exitPictureInPicture().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

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
      includeWebcam, webcamStream,
    }}>
      {children}
    </QuickRecordingContext.Provider>
  );
}
