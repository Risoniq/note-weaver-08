import { useState, useEffect } from "react";
import { useProjects } from "@/hooks/useProjects";
import { supabase } from "@/integrations/supabase/client";
import { FolderKanban, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface ProjectAssignmentProps {
  recordingId: string;
}

export function ProjectAssignment({ recordingId }: ProjectAssignmentProps) {
  const { projects, isLoading, assignRecording, removeRecording } = useProjects();
  const [assignedProjectIds, setAssignedProjectIds] = useState<string[]>([]);
  const [isLoadingAssigned, setIsLoadingAssigned] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchAssigned = async () => {
      const { data, error } = await supabase
        .from("project_recordings")
        .select("project_id")
        .eq("recording_id", recordingId);
      if (!error && data) {
        setAssignedProjectIds(data.map((r) => r.project_id));
      }
      setIsLoadingAssigned(false);
    };
    fetchAssigned();
  }, [recordingId]);

  const handleAssign = async (projectId: string) => {
    if (assignedProjectIds.includes(projectId)) return;
    try {
      await assignRecording.mutateAsync({ projectId, recordingId });
      setAssignedProjectIds((prev) => [...prev, projectId]);
    } catch {}
  };

  const handleRemove = async (projectId: string) => {
    try {
      await removeRecording.mutateAsync({ projectId, recordingId });
      setAssignedProjectIds((prev) => prev.filter((id) => id !== projectId));
    } catch {}
  };

  const assignedProjects = projects.filter((p) => assignedProjectIds.includes(p.id));
  const availableProjects = projects.filter((p) => !assignedProjectIds.includes(p.id));

  if (isLoading || isLoadingAssigned) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <FolderKanban className="h-4 w-4 text-foreground shrink-0" />

      {assignedProjects.map((p) => (
        <Badge
          key={p.id}
          variant="secondary"
          className="flex items-center gap-1 pr-1"
          style={{ borderLeft: `3px solid ${p.color}` }}
        >
          {p.name}
          <button
            onClick={() => handleRemove(p.id)}
            className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}

      {availableProjects.length > 0 && (
        <Select onValueChange={handleAssign} value="">
          <SelectTrigger className="h-7 w-auto min-w-[140px] text-xs border-dashed text-foreground data-[placeholder]:text-foreground">
            <SelectValue placeholder="Projekt zuordnen..." />
          </SelectTrigger>
          <SelectContent>
            {availableProjects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                <span className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: p.color }}
                  />
                  {p.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {projects.length === 0 && (
        <span className="text-xs text-muted-foreground">Noch keine Projekte vorhanden</span>
      )}
    </div>
  );
}
