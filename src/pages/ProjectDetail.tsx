import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useProjectRecordings, useProjects } from "@/hooks/useProjects";
import { useAuth } from "@/hooks/useAuth";
import { IFDKpiCards } from "@/components/projects/IFDKpiCards";
import { IFDTimeline } from "@/components/projects/IFDTimeline";
import { IFDSpeakerTrend } from "@/components/projects/IFDSpeakerTrend";
import { IFDTopicCloud } from "@/components/projects/IFDTopicCloud";
import { IFDProactivityRadar } from "@/components/projects/IFDProactivityRadar";
import { AssignRecordingsDialog } from "@/components/projects/AssignRecordingsDialog";
import { InviteToProjectDialog } from "@/components/projects/InviteToProjectDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Trash2, Brain, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useState, useEffect, useRef } from "react";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { removeRecording } = useProjects();
  const [analyzing, setAnalyzing] = useState(false);

  const { data: project, isLoading: projectLoading, refetch: refetchProject } = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const isOwner = project?.user_id === user?.id;

  const { data: recordings, isLoading: recLoading } = useProjectRecordings(id);
  const autoAnalyzeTriggered = useRef(false);

  useEffect(() => {
    if (
      !autoAnalyzeTriggered.current &&
      !analyzing &&
      !recLoading &&
      !projectLoading &&
      project &&
      !project.analysis &&
      recordings &&
      recordings.length > 0 &&
      isOwner
    ) {
      autoAnalyzeTriggered.current = true;
      handleAnalyze();
    }
  }, [recordings, recLoading, projectLoading, project, isOwner]);

  const handleAnalyze = async () => {
    if (!id) return;
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-project", {
        body: { projectId: id },
      });
      if (error) throw error;
      await refetchProject();
      toast.success("Analyse abgeschlossen");
    } catch (e: any) {
      toast.error(e.message || "Analyse fehlgeschlagen");
    } finally {
      setAnalyzing(false);
    }
  };

  if (projectLoading) {
    return (
      <AppLayout>
        <div className="p-6 max-w-6xl mx-auto space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40" />
        </div>
      </AppLayout>
    );
  }

  if (!project) {
    return (
      <AppLayout>
        <div className="p-6 max-w-6xl mx-auto text-center py-16">
          <p className="text-muted-foreground">Projekt nicht gefunden</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/projects")}>
            Zurück
          </Button>
        </div>
      </AppLayout>
    );
  }

  const analysis = project.analysis as any;

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/projects")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: project.color }} />
            <h1 className="text-2xl font-bold">{project.name}</h1>
            <Badge variant="secondary">{project.status}</Badge>
            {!isOwner && (
              <Badge variant="outline">Geteilt</Badge>
            )}
          </div>
          {isOwner && (
            <div className="flex gap-2">
              <InviteToProjectDialog projectId={id!} />
              <AssignRecordingsDialog projectId={id!} />
              <Button variant="outline" size="sm" onClick={handleAnalyze} disabled={analyzing || !recordings?.length}>
                {analyzing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Brain className="h-4 w-4 mr-2" />}
                KI-Analyse
              </Button>
            </div>
          )}
        </div>

        {project.description && (
          <p className="text-muted-foreground">{project.description}</p>
        )}

        {/* KPIs */}
        {recLoading ? (
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : (
          <IFDKpiCards recordings={recordings ?? []} />
        )}

        {/* KI Analysis */}
        {analysis && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Brain className="h-4 w-4" />
                KI-Gesamtanalyse
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {analysis.summary && <p>{analysis.summary}</p>}
              {analysis.progress && (
                <div>
                  <strong>Fortschritt:</strong> {analysis.progress}
                </div>
              )}
              {analysis.recommendations?.length > 0 && (
                <div>
                  <strong>Empfehlungen:</strong>
                  <ul className="list-disc list-inside mt-1">
                    {analysis.recommendations.map((r: string, i: number) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Charts */}
        {!recLoading && recordings && recordings.length > 0 && (
          <>
            <IFDTimeline recordings={recordings} analysis={analysis} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <IFDSpeakerTrend recordings={recordings} />
              <IFDTopicCloud recordings={recordings} analysis={analysis} />
            </div>
            <IFDProactivityRadar recordings={recordings} analysis={analysis} />
          </>
        )}

        {/* Assigned Recordings */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Zugeordnete Meetings ({recordings?.length ?? 0})</CardTitle>
          </CardHeader>
          <CardContent>
            {recLoading ? (
              <Skeleton className="h-20" />
            ) : !recordings?.length ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Noch keine Meetings zugeordnet
              </p>
            ) : (
              <div className="space-y-2">
                {recordings.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-medium text-sm">{r.title || "Ohne Titel"}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString("de-DE")} • {Math.round((r.duration || 0) / 60)} Min
                      </p>
                    </div>
                    {isOwner && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRecording.mutate({ projectId: id!, recordingId: r.id })}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
