import { Monitor, AppWindow, Globe } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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

  return (
    <Popover open={showModeDialog} onOpenChange={setShowModeDialog}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="end">
        <p className="text-xs text-muted-foreground px-2 pb-2 font-medium">Aufnahmemodus wählen</p>
        {modes.map((m) => (
          <button
            key={m.id}
            onClick={() => startRecording(m.id)}
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
      </PopoverContent>
    </Popover>
  );
}
