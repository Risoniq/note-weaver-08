import { useState } from 'react';
import { Monitor, AppWindow, Globe, Camera } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { useQuickRecordingContext } from '@/contexts/QuickRecordingContext';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

const modes = [
  { id: 'monitor' as const, label: 'Gesamter Bildschirm', desc: 'Empfohlen', icon: Monitor },
  { id: 'window' as const, label: 'Anwendungsfenster', desc: 'Einzelnes Fenster', icon: AppWindow },
  { id: 'browser' as const, label: 'Browser-Tab', desc: 'Nur ein Tab', icon: Globe },
];

interface Props {
  children: ReactNode;
}

export function RecordingModeDialog({ children }: Props) {
  const { showModeDialog, setShowModeDialog, startRecording } = useQuickRecordingContext();
  const [includeWebcam, setIncludeWebcam] = useState(false);

  return (
    <Popover open={showModeDialog} onOpenChange={setShowModeDialog}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="end">
        <p className="text-xs text-muted-foreground px-2 pb-2 font-medium">Aufnahmemodus wählen</p>
        {modes.map((m) => (
          <button
            key={m.id}
            onClick={() => startRecording(m.id, includeWebcam)}
            className={cn(
              "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
              "hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <m.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">{m.label}</div>
              <div className="text-xs text-muted-foreground">{m.desc}</div>
            </div>
          </button>
        ))}
        <div className="border-t border-border mt-1 pt-2 px-2">
          <label className="flex items-center gap-2 cursor-pointer py-1">
            <Checkbox
              checked={includeWebcam}
              onCheckedChange={(v) => setIncludeWebcam(v === true)}
            />
            <div className="flex items-center gap-1.5">
              <Camera className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">Eigene Kamera mit aufnehmen</span>
            </div>
          </label>
        </div>
      </PopoverContent>
    </Popover>
  );
}
