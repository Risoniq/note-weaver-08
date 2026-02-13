import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Video, FileText, Download, Loader2, CheckCircle, Clock, AlertCircle } from "lucide-react";

interface Recording {
  id: string;
  meeting_id: string;
  status: string;
  video_url?: string;
  transcript_url?: string;
  transcript_text?: string;
  recall_bot_id?: string;
  created_at: string;
}

interface RecordingViewerProps {
  recordingId: string;
}

export function RecordingViewer({ recordingId }: RecordingViewerProps) {
  const [recording, setRecording] = useState<Recording | null>(null);
  const [status, setStatus] = useState<string>("pending");
  const [isLoading, setIsLoading] = useState(true);
  const [errorPollCount, setErrorPollCount] = useState(0);

  const ERROR_STATUSES = ["waiting_room_rejected", "waiting_room_timeout", "error"];
  const MAX_ERROR_POLLS = 3; // Weitere Polling-Zyklen nach Fehler-Status

  useEffect(() => {
    const checkStatus = async () => {
      try {
        // Sync recording status via edge function (nutzt jetzt id statt meetingId)
        const { data: syncData, error: syncError } = await supabase.functions.invoke(
          "sync-recording",
          { body: { id: recordingId } }
        );

        if (syncError) {
          console.error("Sync error:", syncError);
        }

        if (syncData?.status) {
          const newStatus = syncData.status;
          
          // Wenn Status von Fehler zu Nicht-Fehler wechselt, Counter zurücksetzen
          if (ERROR_STATUSES.includes(status) && !ERROR_STATUSES.includes(newStatus)) {
            console.log(`Status korrigiert: ${status} -> ${newStatus}`);
            setErrorPollCount(0);
          }
          
          // Bei Fehler-Status: Counter hochzählen
          if (ERROR_STATUSES.includes(newStatus)) {
            setErrorPollCount(prev => prev + 1);
          }
          
          setStatus(newStatus);
        }

        // If done, fetch recording data from table
        if (syncData?.status === "done") {
          const { data: recordingData, error: fetchError } = await supabase
            .from("recordings")
            .select("*")
            .eq("id", recordingId)
            .maybeSingle();

          if (fetchError) {
            console.error("Fetch error:", fetchError);
          } else if (recordingData) {
            setRecording(recordingData as Recording);
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
    // Bei Fehler-Status: weiter pollen bis MAX_ERROR_POLLS erreicht
    const interval = setInterval(() => {
      const isErrorStatus = ERROR_STATUSES.includes(status);
      const shouldStopErrorPolling = isErrorStatus && errorPollCount >= MAX_ERROR_POLLS;
      
      if (status !== "done" && !shouldStopErrorPolling) {
        checkStatus();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [recordingId, status, errorPollCount]);

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
      case "joining":
        return (
          <Badge variant="secondary">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Bot tritt bei
          </Badge>
        );
      case "waiting_room":
        return (
          <Badge className="bg-amber-500 text-white">
            <Clock className="h-3 w-3 mr-1" />
            Im Wartebereich
          </Badge>
        );
      case "waiting_room_rejected":
        return (
          <Badge variant="destructive">
            <AlertCircle className="h-3 w-3 mr-1" />
            Abgelehnt
          </Badge>
        );
      case "waiting_room_timeout":
        return (
          <Badge variant="destructive">
            <Clock className="h-3 w-3 mr-1" />
            Timeout
          </Badge>
        );
      case "error":
        return (
          <Badge variant="destructive">
            <AlertCircle className="h-3 w-3 mr-1" />
            Fehler
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

  const getStatusMessage = () => {
    switch (status) {
      case "recording":
        return "Der Bot nimmt das Meeting auf...";
      case "processing":
        return "Die Aufnahme wird verarbeitet...";
      case "joining":
        return "Bot tritt dem Meeting bei...";
      case "waiting_room":
        return (
          <div className="space-y-2">
            <p className="font-medium">Der Bot wartet im Wartebereich</p>
            <p className="text-sm">
              Bitte den Meeting-Host bitten, den Bot aus dem Wartebereich hereinzulassen.
              Bei externen Teams-Meetings erscheint der Bot möglicherweise als "Unverified".
            </p>
          </div>
        );
      case "waiting_room_rejected":
        return (
          <div className="space-y-2">
            <p className="font-medium text-destructive">Der Bot wurde abgelehnt</p>
            <p className="text-sm">
              Der Meeting-Host hat den Bot nicht aus dem Wartebereich gelassen oder der Bot wurde entfernt.
              Bei externen Meetings muss der Host den Bot manuell zulassen.
            </p>
          </div>
        );
      case "waiting_room_timeout":
        return (
          <div className="space-y-2">
            <p className="font-medium text-destructive">Wartebereich-Timeout</p>
            <p className="text-sm">
              Der Bot hat zu lange im Wartebereich gewartet und wurde automatisch entfernt.
              Bitte versuche es erneut und lasse den Bot schneller herein.
            </p>
          </div>
        );
      case "error":
        return "Ein Fehler ist aufgetreten.";
      default:
        return "Warte auf den Bot...";
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
            {!["waiting_room_rejected", "waiting_room_timeout", "error"].includes(status) && (
              <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
            )}
            {["waiting_room_rejected", "waiting_room_timeout", "error"].includes(status) && (
              <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            )}
            <div className="text-muted-foreground">
              {getStatusMessage()}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Recording ID: {recordingId}
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
