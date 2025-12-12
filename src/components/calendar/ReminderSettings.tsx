import { Bell, BellOff, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface ReminderSettingsProps {
  enabled: boolean;
  minutesBefore: number;
  onEnabledChange: (enabled: boolean) => void;
  onMinutesChange: (minutes: number) => void;
  notificationSupported: boolean;
  notificationPermission: NotificationPermission;
  onRequestPermission: () => Promise<boolean>;
}

export const ReminderSettings = ({
  enabled,
  minutesBefore,
  onEnabledChange,
  onMinutesChange,
  notificationSupported,
  notificationPermission,
  onRequestPermission,
}: ReminderSettingsProps) => {
  const handleEnableNotifications = async () => {
    if (notificationPermission !== 'granted') {
      const granted = await onRequestPermission();
      if (granted) {
        onEnabledChange(true);
      }
    } else {
      onEnabledChange(true);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${
            enabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
          }`}>
            {enabled ? <BellRing size={20} /> : <Bell size={20} />}
          </div>
          <div>
            <h3 className="font-medium text-foreground">Meeting-Erinnerungen</h3>
            <p className="text-sm text-muted-foreground">
              {enabled 
                ? `${minutesBefore} Minuten vor Beginn` 
                : 'Deaktiviert'}
            </p>
          </div>
        </div>

        <Switch
          checked={enabled}
          onCheckedChange={handleEnableNotifications}
        />
      </div>

      {enabled && (
        <div className="space-y-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <Label htmlFor="minutes-before" className="text-sm text-muted-foreground">
              Erinnerung vor Meeting
            </Label>
            <Select
              value={minutesBefore.toString()}
              onValueChange={(value) => onMinutesChange(parseInt(value))}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 Minute</SelectItem>
                <SelectItem value="5">5 Minuten</SelectItem>
                <SelectItem value="10">10 Minuten</SelectItem>
                <SelectItem value="15">15 Minuten</SelectItem>
                <SelectItem value="30">30 Minuten</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {notificationSupported && notificationPermission !== 'granted' && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">
                Browser-Benachrichtigungen sind nicht aktiviert.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={onRequestPermission}
              >
                <Bell size={14} className="mr-1" />
                Aktivieren
              </Button>
            </div>
          )}

          {notificationPermission === 'denied' && (
            <div className="p-3 bg-destructive/10 rounded-lg">
              <p className="text-sm text-destructive">
                Browser-Benachrichtigungen wurden blockiert. Bitte aktiviere sie in deinen Browser-Einstellungen.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
