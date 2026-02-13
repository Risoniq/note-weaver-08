import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Recording, getStatusLabel, getStatusColor } from "@/types/recording";
import { Calendar, Clock, Loader2, Upload, RotateCcw, User, Users as UsersIcon, Share2 } from "lucide-react";
import { getConsistentParticipantCount } from "@/utils/participantUtils";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface RecordingCardProps {
  recording: Recording;
  onClick: () => void;
  isDeleted?: boolean;
  onRestore?: (id: string) => void;
  ownerEmail?: string;
  sharedByEmail?: string;
}

export const RecordingCard = ({ recording, onClick, isDeleted, onRestore, ownerEmail, sharedByEmail }: RecordingCardProps) => {
  const formattedDate = format(new Date(recording.created_at), "dd. MMM yyyy, HH:mm", { locale: de });
  const duration = recording.duration ? `${Math.floor(recording.duration / 60)} Min` : null;
  
  const isAnalyzing = recording.status === 'processing';
  const hasActiveStatus = ['pending', 'joining', 'recording'].includes(recording.status);
  
  const STALE_THRESHOLD_MS = 4 * 60 * 60 * 1000;
  const isStale = hasActiveStatus && 
    (Date.now() - new Date(recording.created_at).getTime()) > STALE_THRESHOLD_MS;
  
  const isActive = hasActiveStatus && !isStale;
  const displayStatus = isStale ? 'timeout' : recording.status;

  const participantResult = getConsistentParticipantCount(recording);
  const participantCount = participantResult.count;
  const participantNames = participantResult.names;
  
  return (
    <Card 
      className={`cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5 ${isDeleted ? 'border-2 border-red-500 opacity-75' : 'hover:border-primary/50'}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        {isDeleted && recording.deleted_at && (
          <div className="flex items-center justify-between mb-3 text-sm">
            <Badge variant="destructive" className="text-xs">
              Gelöscht am {format(new Date(recording.deleted_at), "dd.MM.yyyy, HH:mm", { locale: de })}
            </Badge>
            {onRestore && (
              <button
                onClick={(e) => { e.stopPropagation(); onRestore(recording.id); }}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <RotateCcw className="h-3 w-3" /> Wiederherstellen
              </button>
            )}
          </div>
        )}
        <div className="flex flex-col gap-2">
          {/* Header row: title + status */}
          <div className="flex items-start justify-between gap-2">
            {isAnalyzing && !recording.title ? (
              <Skeleton className="h-5 w-3/4" />
            ) : (
              <div className="flex items-center gap-2 min-w-0">
                {recording.source === 'manual' && (
                  <Upload className="h-4 w-4 text-muted-foreground shrink-0" aria-label="Hochgeladene Datei" />
                )}
                <h3 className="font-semibold text-foreground line-clamp-1">
                  {recording.title || `Meeting ${recording.meeting_id.slice(0, 8)}`}
                </h3>
              </div>
            )}
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {sharedByEmail && (
                <Badge className="bg-blue-500/15 text-blue-600 border border-blue-500/30 hover:bg-blue-500/20">
                  <Share2 className="h-3 w-3 mr-1" />
                  Geteilt von {sharedByEmail}
                </Badge>
              )}
              {ownerEmail && (
                <Badge className="bg-primary/15 text-primary border border-primary/30 hover:bg-primary/20">
                  <User className="h-3 w-3 mr-1" />
                  {ownerEmail}
                </Badge>
              )}
              <Badge className={getStatusColor(displayStatus)}>
                {isAnalyzing && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                {getStatusLabel(displayStatus)}
              </Badge>
            </div>
          </div>

          {/* Meta row: date, duration, owner, participants */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              <span>{formattedDate}</span>
            </div>
            {isAnalyzing && !duration ? (
              <Skeleton className="h-4 w-16" />
            ) : duration ? (
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                <span>{duration}</span>
              </div>
            ) : null}
            {participantCount > 0 && (
              <div className="flex items-center gap-1.5">
                <UsersIcon className="h-3.5 w-3.5" />
                <span className="truncate max-w-[400px]">
                  {participantNames.length > 0
                    ? participantNames.join(', ')
                    : `${participantCount} Teilnehmer`}
                </span>
              </div>
            )}
          </div>



        </div>
      </CardContent>
    </Card>
  );
};