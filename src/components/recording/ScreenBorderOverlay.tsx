import { useQuickRecordingContext } from '@/contexts/QuickRecordingContext';

export function ScreenBorderOverlay() {
  const { isRecording, recordingMode } = useQuickRecordingContext();

  if (!isRecording || recordingMode !== 'monitor') return null;

  return (
    <div
      className="fixed inset-0 z-[9999] pointer-events-none border-2 border-destructive"
      aria-hidden="true"
    />
  );
}
