import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProjects, useProjectRecordings } from "@/hooks/useProjects";

interface Props {
  projectId: string;
}

export function AssignRecordingsDialog({ projectId }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { assignRecording } = useProjects();
  const { data: assigned } = useProjectRecordings(projectId);

  const { data: allRecordings } = useQuery({
    queryKey: ["all-recordings-for-assign"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recordings")
        .select("id, title, created_at, status")
        .eq("status", "done")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const assignedIds = new Set(assigned?.map((r: any) => r.id) ?? []);
  const filtered = (allRecordings ?? []).filter(
    (r) => !assignedIds.has(r.id) && (r.title?.toLowerCase().includes(search.toLowerCase()) || !search)
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Meetings zuordnen
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="p-3 border-b">
          <Input
            placeholder="Suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
          />
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Keine Meetings verfügbar</p>
          )}
          {filtered.map((r) => (
            <button
              key={r.id}
              className="flex items-center justify-between w-full p-2 rounded-md text-left hover:bg-muted/50 transition-colors"
              onClick={() => assignRecording.mutateAsync({ projectId, recordingId: r.id })}
              disabled={assignRecording.isPending}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{r.title || "Ohne Titel"}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString("de-DE")}
                </p>
              </div>
              <Check className="h-4 w-4 ml-2 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
