import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Download, Calendar, Users, Clock, ExternalLink } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { de } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { Recording } from "@/types/recording";

interface TranscriptCardProps {
  recording: Recording;
  searchQuery?: string;
}

export const TranscriptCard = ({ recording, searchQuery }: TranscriptCardProps) => {
  const navigate = useNavigate();

  const getPreviewText = (text: string | null, maxLength: number = 200): string => {
    if (!text) return "Kein Transkript verfügbar";
    const cleanText = text.replace(/\n+/g, " ").trim();
    if (cleanText.length <= maxLength) return cleanText;
    return cleanText.slice(0, maxLength) + "...";
  };

  const highlightSearchTerm = (text: string, query: string): React.ReactNode => {
    if (!query || query.length < 2) return text;
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    const parts = text.split(regex);
    
    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const formatDuration = (seconds: number | null): string => {
    if (!seconds) return "—";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const participantCount = recording.participants?.length ?? 0;
  const previewText = getPreviewText(recording.transcript_text);

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer group">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <CardTitle 
              className="text-lg font-medium truncate group-hover:text-primary transition-colors"
              onClick={() => navigate(`/meeting/${recording.id}`)}
            >
              {recording.title || "Unbenanntes Meeting"}
            </CardTitle>
            <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {format(new Date(recording.created_at), "dd. MMM yyyy, HH:mm", { locale: de })}
              </span>
              {recording.duration && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDuration(recording.duration)}
                </span>
              )}
              {participantCount > 0 && (
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {participantCount}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {recording.word_count && (
              <Badge variant="secondary" className="text-xs">
                {recording.word_count.toLocaleString("de-DE")} Wörter
              </Badge>
            )}
            <Badge 
              variant={recording.transcript_text ? "default" : "outline"}
              className="text-xs"
            >
              <FileText className="h-3 w-3 mr-1" />
              {recording.transcript_text ? "Transkript" : "Ausstehend"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
          {searchQuery ? highlightSearchTerm(previewText, searchQuery) : previewText}
        </p>
        <div className="flex items-center gap-2 mt-4">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate(`/meeting/${recording.id}`)}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Details anzeigen
          </Button>
          {recording.transcript_text && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                const blob = new Blob([recording.transcript_text || ""], { type: "text/plain" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${recording.title || "transcript"}_${format(new Date(recording.created_at), "yyyy-MM-dd")}.txt`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
