import { useState } from 'react';
import { RecordingPreferences } from '@/hooks/useRecallCalendar';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Settings2, RefreshCw } from 'lucide-react';

interface RecallRecordingPreferencesProps {
  preferences: RecordingPreferences;
  onUpdatePreferences: (prefs: Partial<RecordingPreferences>) => void;
  onInitPreferences?: () => Promise<boolean>;
}

export const RecallRecordingPreferences = ({
  preferences,
  onUpdatePreferences,
  onInitPreferences,
}: RecallRecordingPreferencesProps) => {
  const [isInitializing, setIsInitializing] = useState(false);

  const handleInitPreferences = async () => {
    if (!onInitPreferences) return;
    setIsInitializing(true);
    try {
      await onInitPreferences();
    } finally {
      setIsInitializing(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Settings2 size={18} className="text-muted-foreground" />
          <h3 className="font-medium text-foreground">Aufnahme-Einstellungen</h3>
        </div>
        {onInitPreferences && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleInitPreferences}
            disabled={isInitializing}
            className="text-xs"
          >
            <RefreshCw size={14} className={isInitializing ? 'animate-spin mr-1' : 'mr-1'} />
            {isInitializing ? 'Aktiviere...' : 'Aktivieren'}
          </Button>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="auto-record" className="text-sm font-medium">
              Automatische Aufnahme
            </Label>
            <p className="text-xs text-muted-foreground">
              Bot tritt automatisch allen Meetings bei
            </p>
          </div>
          <Switch
            id="auto-record"
            checked={preferences.auto_record}
            onCheckedChange={(checked) => onUpdatePreferences({ auto_record: checked })}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="record-all" className="text-sm font-medium">
              Alle Meetings aufnehmen
            </Label>
            <p className="text-xs text-muted-foreground">
              Auch Meetings, zu denen du eingeladen wurdest
            </p>
          </div>
          <Switch
            id="record-all"
            checked={preferences.record_all}
            onCheckedChange={(checked) => onUpdatePreferences({ record_all: checked })}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="record-only-owned" className="text-sm font-medium">
              Nur eigene Meetings
            </Label>
            <p className="text-xs text-muted-foreground">
              Nur Meetings aufnehmen, die du organisiert hast
            </p>
          </div>
          <Switch
            id="record-only-owned"
            checked={preferences.record_only_owned}
            onCheckedChange={(checked) => onUpdatePreferences({ record_only_owned: checked })}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="record-external" className="text-sm font-medium">
              Externe Meetings aufnehmen
            </Label>
            <p className="text-xs text-muted-foreground">
              Meetings mit externen Teilnehmern aufnehmen
            </p>
          </div>
          <Switch
            id="record-external"
            checked={preferences.record_external}
            onCheckedChange={(checked) => onUpdatePreferences({ record_external: checked })}
          />
        </div>
      </div>
    </div>
  );
};
