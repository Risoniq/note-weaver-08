export interface RiskItem {
  nr: number;
  risikobereich: string;
  beschreibung: string;
  eintrittswahrscheinlichkeit: 'Niedrig' | 'Mittel' | 'Hoch';
  auswirkung: 'Niedrig' | 'Mittel' | 'Hoch';
  risikoniveau: 'Niedrig' | 'Mittel' | 'Hoch';
  massnahmen: string;
  verantwortlich: string;
  nachweis: string;
}

export interface MeetingAnalysis {
  summary: string;
  keyPoints: string[];
  actionItems: string[];
  wordCount: number;
  risks?: RiskItem[];
}

export interface Meeting {
  id: string;
  title: string;
  date: string;
  transcript: string;
  analysis: MeetingAnalysis;
  captureMode: 'tab' | 'mic';
  duration: number;
  audioBlob?: Blob;
  audioUrl?: string;
}

export type CaptureMode = 'tab' | 'mic';
export type ViewType = 'dashboard' | 'record' | 'calendar';
