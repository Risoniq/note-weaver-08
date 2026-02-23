import { useState } from 'react';
import { X, Download, FileAudio, FileText, CheckCircle } from 'lucide-react';
import { Meeting } from '@/types/meeting';
import { downloadTranscript, formatDuration } from '@/utils/meetingAnalysis';
import { getAudioUrl } from '@/hooks/useMeetingStorage';
import { useToast } from '@/hooks/use-toast';

interface DownloadModalProps {
  meeting: Meeting;
  onClose: () => void;
}

export const DownloadModal = ({ meeting, onClose }: DownloadModalProps) => {
  const { toast } = useToast();
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);

  const handleDownloadAudio = async () => {
    setIsLoadingAudio(true);
    try {
      let url: string | null = null;

      // Prefer local blob (just recorded)
      if (meeting.audioBlob) {
        url = URL.createObjectURL(meeting.audioBlob);
      } else if (meeting.audioUrl) {
        // Generate fresh signed URL from storage path
        url = await getAudioUrl(meeting.audioUrl);
      }

      if (!url) {
        toast({ title: "Fehler", description: "Audio-Datei nicht verfügbar", variant: "destructive" });
        return;
      }

      const extension = meeting.audioBlob?.type?.includes('webm') ? 'webm' : 'mp3';
      const a = document.createElement('a');
      a.href = url;
      a.download = `${meeting.title.replace(/[^a-z0-9]/gi, '_')}_${new Date(meeting.date).toISOString().split('T')[0]}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      toast({ title: "Audio-Download gestartet", description: `${meeting.title}.${extension}` });
    } catch (err) {
      console.error('Audio download error:', err);
      toast({ title: "Fehler", description: "Audio konnte nicht heruntergeladen werden", variant: "destructive" });
    } finally {
      setIsLoadingAudio(false);
    }
  };

  const handleDownloadTranscript = () => {
    downloadTranscript(meeting);
    toast({ title: "Transkript-Download gestartet", description: `${meeting.title}.txt` });
  };

  return (
    <div 
      className="fixed inset-0 bg-foreground/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" 
      onClick={onClose}
    >
      <div 
        className="bg-card rounded-2xl max-w-lg w-full border border-border shadow-xl animate-scale-in" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-success/10 rounded-xl">
                <CheckCircle className="h-6 w-6 text-success" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Aufnahme beendet</h2>
                <p className="text-sm text-muted-foreground">
                  {formatDuration(meeting.duration)} aufgenommen
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-xl transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="bg-secondary/50 rounded-xl p-4">
            <h3 className="font-semibold text-foreground mb-1">{meeting.title}</h3>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {meeting.analysis.summary}
            </p>
            <div className="flex gap-2 mt-3">
              <span className="px-2 py-1 bg-primary/10 text-primary rounded-lg text-xs font-medium">
                {meeting.analysis.wordCount} Wörter
              </span>
              <span className="px-2 py-1 bg-accent/10 text-accent rounded-lg text-xs font-medium">
                {meeting.analysis.keyPoints?.length || 0} Punkte
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Downloads verfügbar:</p>
            
            {/* Audio Download */}
            <button
              onClick={handleDownloadAudio}
              disabled={isLoadingAudio}
              className="w-full flex items-center gap-4 p-4 bg-primary/5 hover:bg-primary/10 border border-primary/20 rounded-xl transition-all group disabled:opacity-50"
            >
              <div className="p-3 bg-primary/10 rounded-xl group-hover:bg-primary/20 transition-colors">
                <FileAudio className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-foreground">Audio-Datei</p>
                <p className="text-sm text-muted-foreground">
                  {isLoadingAudio ? 'Wird vorbereitet...' : `${meeting.audioBlob?.type?.includes('webm') ? 'WebM' : 'Audio'} • ${formatDuration(meeting.duration)}`}
                </p>
              </div>
              <Download className="h-5 w-5 text-primary" />
            </button>

            {/* Transcript Download */}
            <button
              onClick={handleDownloadTranscript}
              className="w-full flex items-center gap-4 p-4 bg-accent/5 hover:bg-accent/10 border border-accent/20 rounded-xl transition-all group"
            >
              <div className="p-3 bg-accent/10 rounded-xl group-hover:bg-accent/20 transition-colors">
                <FileText className="h-6 w-6 text-accent" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-foreground">Transkript</p>
                <p className="text-sm text-muted-foreground">
                  TXT • {meeting.analysis.wordCount} Wörter
                </p>
              </div>
              <Download className="h-5 w-5 text-accent" />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border">
          <button
            onClick={onClose}
            className="w-full py-3 gradient-hero text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-opacity shadow-primary"
          >
            Fertig
          </button>
        </div>
      </div>
    </div>
  );
};
