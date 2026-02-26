import { Square } from 'lucide-react';
import { useQuickRecordingContext } from '@/contexts/QuickRecordingContext';
import { cn } from '@/lib/utils';

export function RecordingBanner() {
  const { isRecording, elapsedSeconds, stopRecording } = useQuickRecordingContext();

  if (!isRecording) return null;

  const mins = Math.floor(elapsedSeconds / 60).toString().padStart(2, '0');
  const secs = (elapsedSeconds % 60).toString().padStart(2, '0');

  return (
    <div className={cn(
      "fixed top-0 left-0 right-0 z-[9998] flex items-center justify-center gap-3 px-4 py-2",
      "bg-destructive text-destructive-foreground text-sm font-medium"
    )}>
      <span className="relative flex h-3 w-3">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive-foreground opacity-75" />
        <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive-foreground" />
      </span>
      <span>Aufnahme läuft… {mins}:{secs}</span>
      <button
        onClick={stopRecording}
        className="ml-2 flex items-center gap-1.5 rounded-md bg-destructive-foreground/20 px-3 py-1 hover:bg-destructive-foreground/30 transition-colors"
      >
        <Square className="h-3 w-3 fill-current" />
        Stopp
      </button>
    </div>
  );
}
