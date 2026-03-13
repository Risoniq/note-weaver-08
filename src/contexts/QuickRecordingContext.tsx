import { createContext, useContext, useState, useRef, useCallback, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { saveBlob, deleteBlob, getPendingIds, getBlob } from '@/hooks/useIndexedDBBackup';

const MAX_CHUNK_BYTES = 750 * 1024 * 1024;
const MAX_DURATION_SECONDS = 7200; // 2 hours

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
  pendingUploads: number;
  retryPendingUploads: () => Promise<void>;
  isRetrying: boolean;
}

const QuickRecordingContext = createContext<QuickRecordingContextValue | null>(null);

const fallback: QuickRecordingContextValue = {
  isRecording: false, recordingMode: null, elapsedSeconds: 0,
  showModeDialog: false, setShowModeDialog: () => {}, openModeDialog: () => {},
  startRecording: async () => {}, stopRecording: async () => {},
  error: '', includeWebcam: false, webcamStream: null,
  pendingUploads: 0, retryPendingUploads: async () => {}, isRetrying: false,
};

export function useQuickRecordingContext() {
  const ctx = useContext(QuickRecordingContext);
  return ctx ?? fallback;
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
  const [pendingUploads, setPendingUploads] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

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
  const mimeTypeRef = useRef<string>('video/webm');

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
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(() => {});
    }
    if (pipVideoRef.current) {
      pipVideoRef.current.srcObject = null;
      pipVideoRef.current = null;
    }
  }, []);

  const resetState = useCallback(() => {
    setIsRecording(false);
    isRecordingRef.current = false;
    setRecordingMode(null);
    recordingModeRef.current = null;
    setElapsedSeconds(0);
    setIncludeWebcam(false);
    isStoppingRef.current = false;
  }, []);

  /** Upload chunks with IndexedDB backup fallback */
  const uploadChunks = useCallback(async (chunks: Blob[], mimeType: string) => {
    const blob = new Blob(chunks, { type: mimeType });
    if (blob.size === 0) {
      toast({ title: 'Fehler', description: 'Keine Aufnahmedaten vorhanden.', variant: 'destructive' });
      return;
    }

    // Save to IndexedDB FIRST as backup before attempting upload
    const backupId = `recording-${Date.now()}`;
    try {
      await saveBlob(backupId, blob);
      console.log(`Recording backed up to IndexedDB: ${backupId} (${(blob.size / 1024 / 1024).toFixed(1)} MB)`);
    } catch (backupErr) {
      console.warn('IndexedDB backup failed (continuing with upload):', backupErr);
    }

    toast({ title: 'Aufnahme beendet', description: 'Wird hochgeladen und transkribiert…', id: 'recording-stop' });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: 'Fehler', description: 'Nicht eingeloggt. Aufnahme lokal gesichert.', variant: 'destructive' });
        return; // Keep IndexedDB backup
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
        // Upload succeeded — remove IndexedDB backup
        try { await deleteBlob(backupId); } catch {}
      } else {
        toast({ title: 'Fehler', description: result.error || 'Upload fehlgeschlagen. Aufnahme lokal gesichert.', variant: 'destructive' });
        // Keep IndexedDB backup for retry
      }
    } catch (uploadErr: any) {
      console.error('Upload failed:', uploadErr);
      toast({ title: 'Upload fehlgeschlagen', description: 'Die Aufnahme wurde lokal gesichert und kann später erneut hochgeladen werden.', variant: 'destructive' });
      // Keep IndexedDB backup for retry
    }
  }, []);

  const openModeDialog = useCallback(() => {
    setShowModeDialog(true);
  }, []);

  // Use a ref to trigger stopRecording from the timer without calling it inside setState
  const shouldStopRef = useRef(false);

  const stopRecording = useCallback(async () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;

    try {
      const recorder = mediaRecorderRef.current;
      const chunks = [...chunksRef.current];
      const mimeType = mimeTypeRef.current;

      // If recorder is already inactive or missing, handle ghost state
      if (!recorder || recorder.state === 'inactive') {
        stopAllTracks();
        resetState();
        chunksRef.current = [];
        mediaRecorderRef.current = null;

        // Still upload whatever chunks we have
        if (chunks.length > 0) {
          await uploadChunks(chunks, mimeType);
        }
        return;
      }

      return new Promise<void>((resolve) => {
        recorder.onstop = async () => {
          try {
            stopAllTracks();
            resetState();

            const allChunks = [...chunksRef.current];
            chunksRef.current = [];
            mediaRecorderRef.current = null;

            await uploadChunks(allChunks, recorder.mimeType);
          } catch (innerErr) {
            console.error('[QuickRecording] Error in onstop handler:', innerErr);
          }
          resolve();
        };
        recorder.stop();
      });
    } catch (err: any) {
      console.error('[QuickRecording] stopRecording failed:', err);
      stopAllTracks();
      resetState();
      chunksRef.current = [];
      mediaRecorderRef.current = null;
      toast({ title: 'Fehler beim Stoppen', description: err?.message || 'Unbekannter Fehler', variant: 'destructive' });
    }
  }, [stopAllTracks, resetState, uploadChunks]);

  // Effect to handle deferred stop (from max duration timer)
  useEffect(() => {
    if (shouldStopRef.current && isRecording) {
      shouldStopRef.current = false;
      stopRecording();
    }
  });

  const startRecording = useCallback(async (mode: RecordingMode, withWebcam = false) => {
    setError('');
    setShowModeDialog(false);
    chunksRef.current = [];
    totalChunkSizeRef.current = 0;
    isStoppingRef.current = false;
    shouldStopRef.current = false;
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
        const camStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, facingMode: 'user' },
        });
        webcamStreamRef.current = camStream;
        setWebcamStream(camStream);

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
        };
        canvasIntervalRef.current = setInterval(drawFrame, 33);

        const canvasStream = canvas.captureStream(30);
        videoTracks = canvasStream.getVideoTracks();
      } else {
        videoTracks = displayStream.getVideoTracks();
      }

      const combinedStream = new MediaStream([
        ...videoTracks,
        ...destination.stream.getAudioTracks(),
      ]);

      const selectedMimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus' : 'video/webm';
      mimeTypeRef.current = selectedMimeType;

      const mediaRecorder = new MediaRecorder(combinedStream, { mimeType: selectedMimeType });

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

      timerRef.current = setInterval(() => {
        setElapsedSeconds(s => {
          const next = s + 1;
          if (next >= MAX_DURATION_SECONDS) {
            // Don't call stopRecording inside setState — use ref to defer
            toast({ title: 'Maximale Aufnahmedauer erreicht', description: 'Aufnahme nach 2 Stunden automatisch beendet.', variant: 'destructive', id: 'recording-max-duration' });
            shouldStopRef.current = true;
          }
          return next;
        });
      }, 1000);

      // Track ended handler — robust: works even if recorder already inactive
      displayStream.getVideoTracks()[0]?.addEventListener('ended', () => {
        setTimeout(() => {
          if (isRecordingRef.current) {
            stopRecording();
          }
        }, 300);
      });

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
  }, [stopAllTracks, stopRecording]);

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

  // Check for pending uploads on mount
  const checkPendingUploads = useCallback(async () => {
    try {
      const ids = await getPendingIds();
      setPendingUploads(ids.length);
    } catch {
      setPendingUploads(0);
    }
  }, []);

  useEffect(() => {
    checkPendingUploads();
  }, [checkPendingUploads]);

  // Auto-retry pending uploads when user has a valid session
  const retryPendingUploads = useCallback(async () => {
    if (isRetrying) return;
    setIsRetrying(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: 'Nicht eingeloggt', description: 'Bitte melde dich an, um ausstehende Aufnahmen hochzuladen.', variant: 'destructive' });
        setIsRetrying(false);
        return;
      }

      const ids = await getPendingIds();
      if (ids.length === 0) {
        setPendingUploads(0);
        setIsRetrying(false);
        return;
      }

      let successCount = 0;
      let failCount = 0;

      for (const id of ids) {
        try {
          const blob = await getBlob(id);
          if (!blob || blob.size === 0) {
            await deleteBlob(id);
            continue;
          }

          // Re-check session before each upload (token might expire during batch)
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          if (!currentSession) {
            failCount += (ids.length - successCount);
            break;
          }

          const now = new Date();
          const title = `Aufnahme (wiederhergestellt) ${now.toLocaleDateString('de-DE')} ${now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;

          const formData = new FormData();
          formData.append('audio', blob, `recording-recovered-${Date.now()}.webm`);
          formData.append('title', title);

          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          const response = await fetch(`${supabaseUrl}/functions/v1/transcribe-audio`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${currentSession.access_token}` },
            body: formData,
          });

          const result = await response.json();
          if (response.ok && result.success) {
            await deleteBlob(id);
            successCount++;
            console.log(`[PendingUpload] Successfully uploaded ${id}`);
          } else {
            console.warn(`[PendingUpload] Upload failed for ${id}:`, result.error);
            failCount++;
          }
        } catch (err) {
          console.error(`[PendingUpload] Error uploading ${id}:`, err);
          failCount++;
        }
      }

      if (successCount > 0) {
        toast({ title: '✅ Aufnahmen wiederhergestellt', description: `${successCount} Aufnahme(n) erfolgreich hochgeladen.` });
      }
      if (failCount > 0) {
        toast({ title: 'Upload-Fehler', description: `${failCount} Aufnahme(n) konnten nicht hochgeladen werden.`, variant: 'destructive' });
      }

      await checkPendingUploads();
    } catch (err) {
      console.error('[PendingUpload] Retry failed:', err);
    } finally {
      setIsRetrying(false);
    }
  }, [isRetrying, checkPendingUploads]);

  // Auto-retry on auth state change (user logs in)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // Delay slightly to ensure token is propagated
        setTimeout(() => {
          getPendingIds().then(ids => {
            if (ids.length > 0) {
              console.log(`[PendingUpload] ${ids.length} pending upload(s) found after ${event}, auto-retrying...`);
              retryPendingUploads();
            }
          }).catch(() => {});
        }, 2000);
      }
    });
    return () => subscription.unsubscribe();
  }, [retryPendingUploads]);

  // Also refresh pending count after a recording stops
  useEffect(() => {
    if (!isRecording) {
      const timeout = setTimeout(checkPendingUploads, 3000);
      return () => clearTimeout(timeout);
    }
  }, [isRecording, checkPendingUploads]);

  return (
    <QuickRecordingContext.Provider value={{
      isRecording, recordingMode, elapsedSeconds, showModeDialog, setShowModeDialog,
      openModeDialog, startRecording, stopRecording, error,
      includeWebcam, webcamStream,
      pendingUploads, retryPendingUploads, isRetrying,
    }}>
      {children}
    </QuickRecordingContext.Provider>
  );
}
