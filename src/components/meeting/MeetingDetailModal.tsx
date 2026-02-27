import { useState, useMemo } from 'react';
import { X, Download, FileText, Target, CheckCircle, Clock, Radio, Mic, Play, Check } from 'lucide-react';
import { Meeting } from '@/types/meeting';
import { formatDuration } from '@/utils/meetingAnalysis';
import { getAudioUrl } from '@/hooks/useMeetingStorage';
import { useToast } from '@/hooks/use-toast';
import { useActionItemCompletions } from '@/hooks/useActionItemCompletions';

interface MeetingDetailModalProps {
  meeting: Meeting;
  onClose: () => void;
  onDownload: (meeting: Meeting) => void;
}

export const MeetingDetailModal = ({ meeting, onClose, onDownload }: MeetingDetailModalProps) => {
  const { toast } = useToast();
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const recordingIds = useMemo(() => meeting.meeting_id ? [meeting.meeting_id] : [meeting.id], [meeting]);
  const actionCompletions = useActionItemCompletions(recordingIds);
  const recId = recordingIds[0];

  const handlePlayAudio = async () => {
    if (audioSrc) return; // already loaded
    setIsLoadingAudio(true);
    try {
      if (meeting.audioBlob) {
        setAudioSrc(URL.createObjectURL(meeting.audioBlob));
      } else if (meeting.audioUrl) {
        const url = await getAudioUrl(meeting.audioUrl);
        if (url) setAudioSrc(url);
        else toast({ title: "Fehler", description: "Audio nicht verfügbar", variant: "destructive" });
      }
    } catch (err) {
      console.error('Audio load error:', err);
    } finally {
      setIsLoadingAudio(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-foreground/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in" 
      onClick={onClose}
    >
      <div 
        className="bg-card rounded-2xl max-w-4xl w-full my-8 max-h-[90vh] overflow-y-auto border border-border shadow-xl animate-scale-in" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border p-5 sm:p-6 flex justify-between items-start z-10">
          <div className="flex-1 pr-4">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">{meeting.title}</h2>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Clock size={14} />
                {new Date(meeting.date).toLocaleString('de-DE')}
              </span>
              <span className="px-2.5 py-1 bg-secondary rounded-lg text-xs flex items-center gap-1.5">
                {meeting.captureMode === 'tab' ? <Radio size={12} /> : <Mic size={12} />}
                {meeting.captureMode === 'tab' ? 'Tab' : 'Mikrofon'}
              </span>
              {meeting.duration > 0 && (
                <span className="px-2.5 py-1 bg-primary/10 text-primary rounded-lg text-xs font-medium">
                  ⏱️ {formatDuration(meeting.duration)}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-xl transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-6">
          {/* Audio Player */}
          {(meeting.audioUrl || meeting.audioBlob) && (
            <div className="animate-slide-up">
              {audioSrc ? (
                <audio controls src={audioSrc} className="w-full" />
              ) : (
                <button
                  onClick={handlePlayAudio}
                  disabled={isLoadingAudio}
                  className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  <Play size={16} />
                  {isLoadingAudio ? 'Wird geladen...' : 'Audio abspielen'}
                </button>
              )}
            </div>
          )}

          {/* Summary */}
          {meeting.analysis?.summary && (
            <div className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <h3 className="text-lg font-bold mb-3 text-primary flex items-center gap-2">
                <FileText size={20} />
                Zusammenfassung
              </h3>
              <p className="text-foreground bg-primary/5 p-4 rounded-xl leading-relaxed border border-primary/10">
                {meeting.analysis.summary}
              </p>
            </div>
          )}

          {/* Key Points */}
          {meeting.analysis?.keyPoints?.length > 0 && (
            <div className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <h3 className="text-lg font-bold mb-3 text-accent flex items-center gap-2">
                <Target size={20} />
                Wichtige Punkte
              </h3>
              <ul className="space-y-2">
                {meeting.analysis.keyPoints.map((point, i) => (
                  <li key={i} className="flex gap-3 bg-accent/5 p-3.5 rounded-xl border border-accent/10">
                    <span className="text-accent font-bold flex-shrink-0">{i + 1}.</span>
                    <span className="text-foreground">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action Items */}
          {meeting.analysis?.actionItems?.length > 0 && (
            <div className="animate-slide-up" style={{ animationDelay: '0.3s' }}>
              <h3 className="text-lg font-bold mb-3 text-success flex items-center gap-2">
                <CheckCircle size={20} />
                Action Items
              </h3>
              <ul className="space-y-2">
                {meeting.analysis.actionItems.map((item, i) => (
                  <li key={i} className="flex gap-3 bg-success/5 p-3.5 rounded-xl border border-success/10">
                    <input 
                      type="checkbox" 
                      className="mt-1 flex-shrink-0 w-4 h-4 accent-success" 
                    />
                    <span className="text-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Full Transcript */}
          <div className="animate-slide-up" style={{ animationDelay: '0.5s' }}>
            <h3 className="text-lg font-bold mb-3 text-foreground flex items-center gap-2">
              📄 Vollständiges Transkript
            </h3>
            <div className="bg-secondary/50 p-5 rounded-xl max-h-96 overflow-y-auto border border-border">
              <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                {meeting.transcript}
              </p>
            </div>
          </div>

          {/* Download Button */}
          <div className="pt-4 border-t border-border animate-slide-up" style={{ animationDelay: '0.6s' }}>
            <button
              onClick={() => onDownload(meeting)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 gradient-hero text-primary-foreground rounded-xl hover:opacity-90 transition-all shadow-primary font-medium"
            >
              <Download size={20} />
              Transkript herunterladen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
