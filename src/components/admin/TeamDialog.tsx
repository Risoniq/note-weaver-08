import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { TeamData } from './TeamCard';

interface TeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team?: TeamData | null;
  onSave: (data: { name: string; max_minutes: number }) => Promise<void>;
  isLoading?: boolean;
}

export function TeamDialog({ open, onOpenChange, team, onSave, isLoading }: TeamDialogProps) {
  const [name, setName] = useState('');
  const [hours, setHours] = useState(10);

  useEffect(() => {
    if (open) {
      if (team) {
        setName(team.name);
        setHours(team.max_minutes / 60);
      } else {
        setName('');
        setHours(10);
      }
    }
  }, [open, team]);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    await onSave({
      name: name.trim(),
      max_minutes: Math.round(hours * 60),
    });
  };

  const isEdit = !!team;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Team bearbeiten' : 'Neues Team erstellen'}</DialogTitle>
          <DialogDescription>
            {isEdit 
              ? 'Passe den Namen und das Kontingent des Teams an.'
              : 'Erstelle ein neues Team mit gemeinsamem Meeting-Kontingent.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="team-name">Team-Name</Label>
            <Input
              id="team-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Marketing-Team"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="team-hours">Kontingent (Stunden)</Label>
            <Input
              id="team-hours"
              type="number"
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              min={1}
              step={1}
            />
            <p className="text-xs text-muted-foreground">
              Alle Team-Mitglieder teilen sich dieses Kontingent.
            </p>
          </div>

          {isEdit && team && (
            <div className="text-sm text-muted-foreground p-3 bg-muted rounded-lg">
              <p>Aktuell verbraucht: {Math.round(team.used_minutes / 60 * 10) / 10}h</p>
              <p>Mitglieder: {team.member_count}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || !name.trim()}>
            {isEdit ? 'Speichern' : 'Erstellen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
