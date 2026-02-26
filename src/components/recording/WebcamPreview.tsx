import { useEffect, useRef } from 'react';
import { useQuickRecordingContext } from '@/contexts/QuickRecordingContext';

export function WebcamPreview() {
  const { isRecording, includeWebcam, webcamStream } = useQuickRecordingContext();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && webcamStream) {
      videoRef.current.srcObject = webcamStream;
    }
  }, [webcamStream]);

  if (!isRecording || !includeWebcam || !webcamStream) return null;

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      className="fixed bottom-6 right-6 w-[200px] h-[150px] rounded-2xl shadow-lg border-2 border-white/20 object-cover z-[9997]"
    />
  );
}
