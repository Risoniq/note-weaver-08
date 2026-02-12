import { useState, useMemo } from 'react';
import { X, UserPlus, Search, Crown } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TeamData } from './TeamCard';

interface UserTeam {
  id: string;
  name: string;
  role: string;
}

interface UserData {
  id: string;
  email: string;
  teams: UserTeam[];
  team_id: string | null;
  team_name: string | null;
  team_role: string | null;
}

interface TeamMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: TeamData | null;
  users: UserData[];
  onAssign: (userId: string, teamId: string, role?: string) => Promise<void>;
  onRemove: (userId: string, teamId: string) => Promise<void>;
  onSetRole: (userId: string, role: string, teamId: string) => Promise<void>;
  isLoading?: boolean;
}

export function TeamMembersDialog({ 
  open, 
  onOpenChange, 
  team, 
  users,
  onAssign,
  onRemove,
  onSetRole,
  isLoading 
}: TeamMembersDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const teamMembers = useMemo(() => 
    users.filter(u => (u.teams || []).some(t => t.id === team?.id)),
    [users, team]
  );

  const availableUsers = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return users
      .filter(u => !(u.teams || []).some(t => t.id === team?.id))
      .filter(u => u.email.toLowerCase().includes(query));
  }, [users, team, searchQuery]);

  if (!team) return null;

  const getMemberRole = (user: UserData): string => {
    const membership = (user.teams || []).find(t => t.id === team.id);
    return membership?.role || 'member';
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    await onSetRole(userId, newRole, team.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Mitglieder: {team.name}</DialogTitle>
          <DialogDescription>
            Verwalte die Mitglieder dieses Teams. Alle Mitglieder teilen sich das Team-Kontingent.
            Teamleads können die Meetings aller Mitglieder einsehen.
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
              <ScrollArea className="h-40 rounded-lg border p-2">
                <div className="space-y-2">
                  {teamMembers.map(member => (
                    <div key={member.id} className="flex items-center justify-between p-2 bg-muted rounded">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {getMemberRole(member) === 'lead' && (
                          <Crown className="h-4 w-4 text-amber-500 flex-shrink-0" />
                        )}
                        <span className="text-sm truncate">{member.email}</span>
                        {/* Show other team badges */}
                        {(member.teams || []).filter(t => t.id !== team.id).map(t => (
                          <Badge key={t.id} variant="outline" className="text-xs flex-shrink-0">
                            {t.name}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Select
                          value={getMemberRole(member)}
                          onValueChange={(value) => handleRoleChange(member.id, value)}
                          disabled={isLoading}
                        >
                          <SelectTrigger className="w-28 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="member">Mitglied</SelectItem>
                            <SelectItem value="lead">Teamlead</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRemove(member.id, team.id)}
                          disabled={isLoading}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
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
                        {(user.teams || []).map(t => (
                          <Badge key={t.id} variant="outline" className="text-xs">
                            {t.name}
                          </Badge>
                        ))}
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
