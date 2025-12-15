import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Video, FileText, Download, Loader2, CheckCircle, Clock } from "lucide-react";

interface Recording {
  id: string;
  meeting_id: string;
  status: string;
  video_url?: string;
  transcript_url?: string;
  transcript_text?: string;
  created_at: string;
}

interface RecordingViewerProps {
  meetingId: string;
}

export function RecordingViewer({ meetingId }: RecordingViewerProps) {
  const [recording, setRecording] = useState<Recording | null>(null);
  const [status, setStatus] = useState<string>("pending");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        // Sync recording status via edge function
        const { data: syncData, error: syncError } = await supabase.functions.invoke(
          "sync-recording",
          { body: { meetingId } }
        );

        if (syncError) {
          console.error("Sync error:", syncError);
        }

        if (syncData?.status) {
          setStatus(syncData.status);
        }

        // If done, fetch recording data from table
        if (syncData?.status === "done") {
          const { data: recordingData, error: fetchError } = await supabase
            .from("recordings" as any)
            .select("*")
            .eq("meeting_id", meetingId)
            .maybeSingle();

          if (fetchError) {
            console.error("Fetch error:", fetchError);
          } else if (recordingData) {
            setRecording(recordingData as unknown as Recording);
          }
        }
      } catch (error) {
        console.error("Error checking status:", error);
      } finally {
        setIsLoading(false);
      }
    };

    // Initial check
    checkStatus();

    // Poll every 5 seconds if not done
    const interval = setInterval(() => {
      if (status !== "done") {
        checkStatus();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [meetingId, status]);

  const getStatusBadge = () => {
    switch (status) {
      case "done":
        return (
          <Badge className="bg-success text-success-foreground">
            <CheckCircle className="h-3 w-3 mr-1" />
            Fertig
          </Badge>
        );
      case "recording":
        return (
          <Badge className="bg-recording text-recording-foreground animate-pulse">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Aufnahme läuft
          </Badge>
        );
      case "processing":
        return (
          <Badge className="bg-warning text-warning-foreground">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Verarbeitung
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Warte auf Bot
          </Badge>
        );
    }
  };

  if (isLoading) {
    return (
      <Card className="w-full max-w-xl">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-10 w-32" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-xl">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Video className="h-6 w-6 text-primary" />
          Aufnahme
        </CardTitle>
        {getStatusBadge()}
      </CardHeader>
      <CardContent className="space-y-4">
        {status !== "done" ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
            <p className="text-muted-foreground">
              {status === "recording"
                ? "Der Bot nimmt das Meeting auf..."
                : status === "processing"
                ? "Die Aufnahme wird verarbeitet..."
                : "Warte auf den Bot..."}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Meeting ID: {meetingId}
            </p>
          </div>
        ) : recording ? (
          <div className="space-y-4">
            {/* Video Player */}
            {recording.video_url && (
              <div className="rounded-lg overflow-hidden bg-muted">
                <video
                  src={recording.video_url}
                  controls
                  className="w-full aspect-video"
                />
              </div>
            )}

            {/* Transcript */}
            {recording.transcript_text && (
              <div className="bg-muted/50 p-4 rounded-lg max-h-64 overflow-y-auto">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Transkript
                </h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {recording.transcript_text}
                </p>
              </div>
            )}

            {/* Download Buttons */}
            <div className="flex gap-3">
              {recording.video_url && (
                <Button asChild variant="outline">
                  <a href={recording.video_url} download target="_blank">
                    <Download className="h-4 w-4 mr-2" />
                    Video herunterladen
                  </a>
                </Button>
              )}
              {recording.transcript_url && (
                <Button asChild variant="outline">
                  <a href={recording.transcript_url} download target="_blank">
                    <FileText className="h-4 w-4 mr-2" />
                    Transkript herunterladen
                  </a>
                </Button>
              )}
            </div>
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">
            Keine Aufnahme gefunden.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
