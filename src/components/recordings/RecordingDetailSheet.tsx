import { useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Recording, getStatusLabel, getStatusColor } from "@/types/recording";
import { EditableTitle } from "./EditableTitle";
import { 
  Calendar, 
  Clock, 
  FileText, 
  Download, 
  Video, 
  Target, 
  CheckSquare,
  FileDown,
  ExternalLink,
  Check,
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useActionItemCompletions } from "@/hooks/useActionItemCompletions";

interface RecordingDetailSheetProps {
  recording: Recording | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const RecordingDetailSheet = ({ 
  recording, 
  open, 
  onOpenChange 
}: RecordingDetailSheetProps) => {
  const recordingIds = useMemo(() => recording ? [recording.id] : [], [recording?.id]);
  const actionCompletions = useActionItemCompletions(recordingIds);

  if (!recording) return null;

  const formattedDate = format(new Date(recording.created_at), "dd. MMMM yyyy, HH:mm 'Uhr'", { locale: de });
  const duration = recording.duration 
    ? `${Math.floor(recording.duration / 60)} Min ${recording.duration % 60} Sek` 
    : null;

  const handleDownloadTranscript = () => {
    if (!recording.transcript_text) return;
    
    const blob = new Blob([recording.transcript_text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transkript-${recording.meeting_id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-hidden flex flex-col">
        <SheetHeader className="shrink-0">
          <div className="flex items-start justify-between gap-3">
            <EditableTitle 
              recordingId={recording.id}
              title={recording.title}
              meetingId={recording.meeting_id}
            />
            <Badge className={`shrink-0 ${getStatusColor(recording.status)}`}>
              {getStatusLabel(recording.status)}
            </Badge>
          </div>
          
          {/* Meta Info */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground pt-2">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              <span>{formattedDate}</span>
            </div>
            {duration && (
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                <span>{duration}</span>
              </div>
            )}
            {recording.word_count && (
              <div className="flex items-center gap-1.5">
                <FileText className="h-4 w-4" />
                <span>{recording.word_count.toLocaleString('de-DE')} Wörter</span>
              </div>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6 mt-4">
          <div className="space-y-6 pb-6">
            {/* Video Player */}
            {recording.video_url && (
              <section>
                <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  Video-Aufnahme
                </h3>
                <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                  <video 
                    src={recording.video_url} 
                    controls 
                    className="w-full h-full"
                    preload="metadata"
                  />
                </div>
              </section>
            )}

            {/* Summary */}
            {recording.summary && (
              <section>
                <h3 className="text-sm font-medium text-foreground mb-3">
                  📋 Zusammenfassung
                </h3>
                <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-4">
                  {recording.summary}
                </p>
              </section>
            )}

            {/* Key Points */}
            {recording.key_points && recording.key_points.length > 0 && (
              <section>
                <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Wichtige Punkte ({recording.key_points.length})
                </h3>
                <ul className="space-y-2">
                  {recording.key_points.map((point, index) => (
                    <li 
                      key={index} 
                      className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 flex items-start gap-2"
                    >
                      <span className="text-primary font-medium">•</span>
                      {point}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Action Items */}
            {recording.action_items && recording.action_items.length > 0 && (
              <section>
                <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                  <CheckSquare className="h-4 w-4" />
                  Action Items ({recording.action_items.length})
                </h3>
                <ul className="space-y-2">
                  {recording.action_items.map((item, index) => (
                    <li 
                      key={index} 
                      className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 flex items-start gap-2"
                    >
                      <CheckSquare className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Transcript */}
            {recording.transcript_text && (
              <section>
                <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Transkript
                </h3>
                <div className="bg-muted/50 rounded-lg p-4 max-h-80 overflow-y-auto">
                  <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-sans">
                    {recording.transcript_text}
                  </pre>
                </div>
              </section>
            )}

            <Separator />

            {/* Download Actions */}
            <section className="flex flex-wrap gap-3">
              {recording.video_url && (
                <Button variant="outline" asChild>
                  <a href={recording.video_url} target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4 mr-2" />
                    Video herunterladen
                    <ExternalLink className="h-3 w-3 ml-1.5 opacity-50" />
                  </a>
                </Button>
              )}
              {recording.transcript_text && (
                <Button variant="outline" onClick={handleDownloadTranscript}>
                  <FileDown className="h-4 w-4 mr-2" />
                  Transkript herunterladen
                </Button>
              )}
            </section>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
