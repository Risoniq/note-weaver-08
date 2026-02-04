import { Edit2, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export interface TeamData {
  id: string;
  name: string;
  max_minutes: number;
  used_minutes: number;
  member_count: number;
  created_at: string;
}

interface TeamCardProps {
  team: TeamData;
  onEdit: (team: TeamData) => void;
  onDelete: (teamId: string) => void;
  onManageMembers: (team: TeamData) => void;
  isLoading?: boolean;
}

export function TeamCard({ team, onEdit, onDelete, onManageMembers, isLoading }: TeamCardProps) {
  const percentUsed = team.max_minutes > 0 
    ? Math.min(100, (team.used_minutes / team.max_minutes) * 100) 
    : 0;

  const formatHours = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h`;
    return `${mins}m`;
  };

  const getBarColor = () => {
    if (percentUsed >= 100) return 'bg-destructive';
    if (percentUsed >= 80) return 'bg-amber-500';
    return 'bg-primary';
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-lg">{team.name}</h3>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Users className="h-3 w-3" />
              <span>{team.member_count} {team.member_count === 1 ? 'Mitglied' : 'Mitglieder'}</span>
            </div>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Kontingent</span>
            <span className="font-medium">
              {formatHours(team.used_minutes)} / {formatHours(team.max_minutes)}
            </span>
          </div>
          <Progress 
            value={percentUsed} 
            className="h-2"
            indicatorClassName={getBarColor()}
          />
        </div>

        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={() => onManageMembers(team)}
            disabled={isLoading}
          >
            <Users className="h-4 w-4 mr-1" />
            Mitglieder
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => onEdit(team)}
            disabled={isLoading}
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="destructive" 
                size="sm"
                disabled={isLoading}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Team löschen?</AlertDialogTitle>
                <AlertDialogDescription>
                  Möchtest du das Team <strong>{team.name}</strong> wirklich löschen? 
                  Alle {team.member_count} Mitglieder werden zu Einzelnutzern mit individuellem Kontingent.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(team.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Löschen
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
