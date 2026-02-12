import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, X, UserPlus, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { withTokenRefresh } from "@/lib/retryWithTokenRefresh";

interface TeamMember {
  userId: string;
  email: string;
  teamId: string;
  teamName: string;
}

interface SharedUser {
  id: string;
  shared_with: string;
  email: string;
}

interface TeamShareDropdownProps {
  recordingId: string;
}

export function TeamShareDropdown({ recordingId }: TeamShareDropdownProps) {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [sharedUsers, setSharedUsers] = useState<SharedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch existing shares
      const listRes = await withTokenRefresh(() =>
        supabase.functions.invoke("share-recording", {
          body: { action: "list", recording_id: recordingId },
        })
      );
      if (listRes.data?.success) {
        setSharedUsers(listRes.data.shares || []);
      }

      // Fetch team members via edge function
      const membersRes = await withTokenRefresh(() =>
        supabase.functions.invoke("share-recording", {
          body: { action: "list-team-members" },
        })
      );
      if (membersRes.data?.success && membersRes.data?.members) {
        setTeamMembers(membersRes.data.members);
      }
    } catch (err) {
      console.error("TeamShareDropdown fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [recordingId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const sharedUserIds = new Set(sharedUsers.map((s) => s.shared_with));

  const handleShareSingle = async (member: TeamMember) => {
    if (sharedUserIds.has(member.userId)) return;
    setIsSaving(true);
    try {
      const res = await withTokenRefresh(() =>
        supabase.functions.invoke("share-recording", {
          body: { action: "share", recording_id: recordingId, email: member.email },
        })
      );
      if (res.data?.success) {
        toast.success(`Mit ${member.email} geteilt`);
        fetchData();
      } else {
        toast.error(res.data?.error || "Fehler beim Teilen");
      }
    } catch {
      toast.error("Fehler beim Teilen");
    } finally {
      setIsSaving(false);
    }
  };

  const handleShareTeam = async (teamId: string) => {
    const membersInTeam = teamMembers.filter(
      (m) => m.teamId === teamId && !sharedUserIds.has(m.userId)
    );
    if (membersInTeam.length === 0) {
      toast.info("Bereits mit allen Teammitgliedern geteilt");
      return;
    }
    setIsSaving(true);
    try {
      const res = await withTokenRefresh(() =>
        supabase.functions.invoke("share-recording", {
          body: {
            action: "share-team",
            recording_id: recordingId,
            user_ids: membersInTeam.map((m) => m.userId),
          },
        })
      );
      if (res.data?.success) {
        toast.success(`Mit ${res.data.shared} Teammitglied(ern) geteilt`);
        fetchData();
      } else {
        toast.error(res.data?.error || "Fehler beim Teilen");
      }
    } catch {
      toast.error("Fehler beim Teilen");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnshare = async (shareId: string) => {
    try {
      const res = await withTokenRefresh(() =>
        supabase.functions.invoke("share-recording", {
          body: { action: "unshare", share_id: shareId },
        })
      );
      if (res.data?.success) {
        setSharedUsers((prev) => prev.filter((s) => s.id !== shareId));
        toast.success("Freigabe entfernt");
      }
    } catch {
      toast.error("Fehler beim Entfernen");
    }
  };

  // Group members by team
  const teamGroups = teamMembers.reduce<Record<string, { name: string; members: TeamMember[] }>>(
    (acc, m) => {
      if (!acc[m.teamId]) acc[m.teamId] = { name: m.teamName, members: [] };
      acc[m.teamId].members.push(m);
      return acc;
    },
    {}
  );

  if (isLoading) return null;
  if (teamMembers.length === 0 && sharedUsers.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Users className="h-4 w-4 text-muted-foreground shrink-0" />

      {sharedUsers.map((s) => (
        <Badge
          key={s.id}
          variant="secondary"
          className="flex items-center gap-1 pr-1"
        >
          {s.email}
          <button
            onClick={() => handleUnshare(s.id)}
            className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}

      {teamMembers.length > 0 && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-xs border-dashed gap-1">
              <UserPlus className="h-3 w-3" />
              Mit Team teilen...
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-2" align="start">
            {isSaving && (
              <div className="flex items-center justify-center py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            )}
            {!isSaving && Object.entries(teamGroups).map(([teamId, group]) => (
              <div key={teamId} className="mb-2 last:mb-0">
                <div className="flex items-center justify-between px-2 py-1">
                  <span className="text-xs font-semibold text-muted-foreground">{group.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => handleShareTeam(teamId)}
                  >
                    Alle teilen
                  </Button>
                </div>
                {group.members.map((m) => {
                  const isShared = sharedUserIds.has(m.userId);
                  return (
                    <button
                      key={m.userId}
                      className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded hover:bg-accent transition-colors disabled:opacity-50"
                      disabled={isShared}
                      onClick={() => handleShareSingle(m)}
                    >
                      <Checkbox checked={isShared} className="pointer-events-none" />
                      <span className="truncate">{m.email}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
