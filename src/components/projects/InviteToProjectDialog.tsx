import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { UserPlus, Trash2, Loader2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface Props {
  projectId: string;
}

interface TeamMember {
  userId: string;
  email: string;
  teamId: string;
  teamName: string;
  alreadyInvited: boolean;
}

export function InviteToProjectDialog({ projectId }: Props) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [invitingIds, setInvitingIds] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const { data: members, isLoading } = useQuery({
    queryKey: ["project-members", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("project-invite", {
        body: { action: "list", projectId },
      });
      if (error) throw error;
      return data.members as Array<{ id: string; email: string; status: string; user_id: string }>;
    },
    enabled: open,
  });

  const { data: teamMembers, isLoading: teamLoading } = useQuery({
    queryKey: ["project-team-members", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("project-invite", {
        body: { action: "list-team-members", projectId },
      });
      if (error) throw error;
      return data.members as TeamMember[];
    },
    enabled: open,
  });

  // Group team members by team
  const groupedByTeam = (teamMembers ?? []).reduce<Record<string, { teamName: string; members: TeamMember[] }>>((acc, m) => {
    if (!acc[m.teamId]) {
      acc[m.teamId] = { teamName: m.teamName, members: [] };
    }
    acc[m.teamId].members.push(m);
    return acc;
  }, {});

  const memberUserIds = new Set((members ?? []).map((m) => m.user_id));

  const handleInviteByUserId = async (userId: string) => {
    setInvitingIds((prev) => new Set(prev).add(userId));
    try {
      const { data, error } = await supabase.functions.invoke("project-invite", {
        body: { action: "invite-by-user-id", projectId, userId },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      toast.success("Mitglied eingeladen");
      queryClient.invalidateQueries({ queryKey: ["project-members", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-team-members", projectId] });
    } catch (e: any) {
      toast.error(e.message || "Einladung fehlgeschlagen");
    } finally {
      setInvitingIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const handleInviteAllTeam = async (teamId: string) => {
    const teamGroup = groupedByTeam[teamId];
    if (!teamGroup) return;
    const toInvite = teamGroup.members.filter((m) => !m.alreadyInvited && !memberUserIds.has(m.userId));
    for (const m of toInvite) {
      await handleInviteByUserId(m.userId);
    }
  };

  const handleInvite = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("project-invite", {
        body: { action: "invite", projectId, email: email.trim() },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      toast.success("Einladung gesendet");
      setEmail("");
      queryClient.invalidateQueries({ queryKey: ["project-members", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-team-members", projectId] });
    } catch (e: any) {
      toast.error(e.message || "Einladung fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (memberId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("project-invite", {
        body: { action: "remove", memberId },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      toast.success("Mitglied entfernt");
      queryClient.invalidateQueries({ queryKey: ["project-members", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-team-members", projectId] });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserPlus className="h-4 w-4 mr-2" />
          Einladen
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mitglieder einladen</DialogTitle>
        </DialogHeader>

        {/* Team Members Section */}
        {teamLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Teammitglieder laden...
          </div>
        ) : Object.keys(groupedByTeam).length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Users className="h-4 w-4" />
              Aus Team auswählen
            </div>
            <ScrollArea className="max-h-48">
              <div className="space-y-3">
                {Object.entries(groupedByTeam).map(([teamId, group]) => {
                  const allInvited = group.members.every((m) => m.alreadyInvited || memberUserIds.has(m.userId));
                  return (
                    <div key={teamId} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase text-muted-foreground">{group.teamName}</span>
                        {!allInvited && (
                          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => handleInviteAllTeam(teamId)}>
                            Alle einladen
                          </Button>
                        )}
                      </div>
                      {group.members.map((m) => {
                        const isInvited = m.alreadyInvited || memberUserIds.has(m.userId);
                        const isInviting = invitingIds.has(m.userId);
                        return (
                          <label
                            key={`${m.teamId}-${m.userId}`}
                            className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer"
                          >
                            <Checkbox
                              checked={isInvited}
                              disabled={isInvited || isInviting}
                              onCheckedChange={() => handleInviteByUserId(m.userId)}
                            />
                            <span className="text-sm flex-1 truncate">{m.email}</span>
                            {isInviting && <Loader2 className="h-3 w-3 animate-spin" />}
                            {isInvited && <Badge variant="secondary" className="text-xs">Eingeladen</Badge>}
                          </label>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        ) : null}

        {Object.keys(groupedByTeam).length > 0 && <Separator />}

        {/* Email invite section */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Per E-Mail einladen</p>
          <div className="flex gap-2">
            <Input
              placeholder="E-Mail-Adresse"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleInvite()}
            />
            <Button onClick={handleInvite} disabled={loading || !email.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Einladen"}
            </Button>
          </div>
        </div>

        <Separator />

        {/* Existing members */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Mitglieder</p>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Laden...</p>
          ) : !members?.length ? (
            <p className="text-sm text-muted-foreground">Noch keine Mitglieder eingeladen</p>
          ) : (
            <ScrollArea className="max-h-40">
              <div className="space-y-2">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between p-2 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <span className="text-sm truncate">{m.email}</span>
                      <Badge variant={m.status === "joined" ? "default" : "secondary"}>
                        {m.status === "joined" ? "Beigetreten" : "Eingeladen"}
                      </Badge>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleRemove(m.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
