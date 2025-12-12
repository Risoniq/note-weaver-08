export interface MeetingAnalysis {
  summary: string;
  keyPoints: string[];
  actionItems: string[];
  wordCount: number;
}

export interface Meeting {
  id: string;
  title: string;
  date: string;
  transcript: string;
  analysis: MeetingAnalysis;
  captureMode: 'tab' | 'mic';
  duration: number;
}

export type CaptureMode = 'tab' | 'mic';
export type ViewType = 'dashboard' | 'record';
