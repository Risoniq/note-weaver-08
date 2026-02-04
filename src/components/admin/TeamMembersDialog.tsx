import { useState, useMemo } from 'react';
import { X, UserPlus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { TeamData } from './TeamCard';

interface UserData {
  id: string;
  email: string;
  team_id: string | null;
  team_name: string | null;
}

interface TeamMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: TeamData | null;
  users: UserData[];
  onAssign: (userId: string, teamId: string) => Promise<void>;
  onRemove: (userId: string) => Promise<void>;
  isLoading?: boolean;
}

export function TeamMembersDialog({ 
  open, 
  onOpenChange, 
  team, 
  users,
  onAssign,
  onRemove,
  isLoading 
}: TeamMembersDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const teamMembers = useMemo(() => 
    users.filter(u => u.team_id === team?.id),
    [users, team]
  );

  const availableUsers = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return users
      .filter(u => u.team_id !== team?.id)
      .filter(u => u.email.toLowerCase().includes(query));
  }, [users, team, searchQuery]);

  if (!team) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Mitglieder: {team.name}</DialogTitle>
          <DialogDescription>
            Verwalte die Mitglieder dieses Teams. Alle Mitglieder teilen sich das Team-Kontingent.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Members */}
          <div>
            <h4 className="text-sm font-medium mb-2">Aktuelle Mitglieder ({teamMembers.length})</h4>
            {teamMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground p-3 bg-muted rounded-lg">
                Noch keine Mitglieder zugeordnet.
              </p>
            ) : (
              <ScrollArea className="h-32 rounded-lg border p-2">
                <div className="space-y-2">
                  {teamMembers.map(member => (
                    <div key={member.id} className="flex items-center justify-between p-2 bg-muted rounded">
                      <span className="text-sm">{member.email}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemove(member.id)}
                        disabled={isLoading}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Add Members */}
          <div>
            <h4 className="text-sm font-medium mb-2">Mitglied hinzufügen</h4>
            <div className="relative mb-2">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="E-Mail suchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <ScrollArea className="h-40 rounded-lg border p-2">
              <div className="space-y-2">
                {availableUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {searchQuery ? 'Keine Benutzer gefunden.' : 'Keine verfügbaren Benutzer.'}
                  </p>
                ) : (
                  availableUsers.map(user => (
                    <div key={user.id} className="flex items-center justify-between p-2 hover:bg-muted rounded">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{user.email}</span>
                        {user.team_name && (
                          <Badge variant="outline" className="text-xs">
                            {user.team_name}
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onAssign(user.id, team.id)}
                        disabled={isLoading}
                      >
                        <UserPlus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
