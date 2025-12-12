import { Calendar, Clock, Download, Trash2 } from 'lucide-react';
import { Meeting } from '@/types/meeting';
import { formatDuration } from '@/utils/meetingAnalysis';

interface MeetingCardProps {
  meeting: Meeting;
  onSelect: (meeting: Meeting) => void;
  onDownload: (meeting: Meeting) => void;
  onDelete: (id: string) => void;
}

export const MeetingCard = ({ meeting, onSelect, onDownload, onDelete }: MeetingCardProps) => {
  return (
    <div
      className="bg-card rounded-2xl shadow-md hover:shadow-lg border border-border transition-all duration-300 overflow-hidden cursor-pointer group hover:border-primary/30 animate-fade-in"
      onClick={() => onSelect(meeting)}
    >
      <div className="p-5 sm:p-6">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg sm:text-xl font-bold text-foreground flex-1 pr-2 group-hover:text-primary transition-colors">
            {meeting.title}
          </h3>
          <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDownload(meeting);
              }}
              className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
              title="Herunterladen"
            >
              <Download size={18} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(meeting.id);
              }}
              className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
              title="Löschen"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-4">
          <div className="flex items-center gap-1.5">
            <Calendar size={14} />
            {new Date(meeting.date).toLocaleDateString('de-DE')}
          </div>
          <div className="flex items-center gap-1.5">
            <Clock size={14} />
            {new Date(meeting.date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </div>
          {meeting.duration > 0 && (
            <span className="text-muted-foreground">
              {formatDuration(meeting.duration)}
            </span>
          )}
        </div>

        <p className="text-sm sm:text-base text-muted-foreground line-clamp-2 mb-4 leading-relaxed">
          {meeting.analysis?.summary || 'Keine Zusammenfassung verfügbar'}
        </p>

        <div className="flex flex-wrap gap-2">
          <span className="px-3 py-1.5 bg-primary/10 text-primary rounded-full text-xs sm:text-sm font-medium">
            {meeting.analysis.wordCount || 0} Wörter
          </span>
          <span className="px-3 py-1.5 bg-accent/10 text-accent rounded-full text-xs sm:text-sm font-medium">
            {meeting.analysis.keyPoints?.length || 0} Punkte
          </span>
          <span className="px-3 py-1.5 bg-success/10 text-success rounded-full text-xs sm:text-sm font-medium">
            {meeting.analysis.actionItems?.length || 0} Actions
          </span>
        </div>
      </div>
    </div>
  );
};
