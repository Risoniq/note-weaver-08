export interface RecordingParticipant {
  id: string;
  name: string;
}

export interface Recording {
  id: string;
  created_at: string;
  updated_at: string;
  meeting_id: string;
  meeting_url: string | null;
  recall_bot_id: string | null;
  status: string;
  video_url: string | null;
  transcript_url: string | null;
  transcript_text: string | null;
  title: string | null;
  duration: number | null;
  summary: string | null;
  key_points: string[] | null;
  action_items: string[] | null;
  word_count: number | null;
  participants: RecordingParticipant[] | null;
}

export type RecordingStatus = 'pending' | 'joining' | 'recording' | 'processing' | 'done' | 'error';

export const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    pending: 'Ausstehend',
    joining: 'Beitritt...',
    recording: 'Aufnahme läuft',
    processing: 'Verarbeitung...',
    done: 'Fertig',
    error: 'Fehler',
  };
  return labels[status] || status;
};

export const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    pending: 'bg-muted text-muted-foreground',
    joining: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400',
    recording: 'bg-red-500/20 text-red-700 dark:text-red-400',
    processing: 'bg-blue-500/20 text-blue-700 dark:text-blue-400',
    done: 'bg-green-500/20 text-green-700 dark:text-green-400',
    error: 'bg-destructive/20 text-destructive',
  };
  return colors[status] || 'bg-muted text-muted-foreground';
};
