import { MeetingAnalysis } from '@/types/meeting';

export const generateAnalysis = (transcript: string): MeetingAnalysis => {
  if (!transcript || transcript.trim().length === 0) {
    return {
      summary: 'Keine Transkription verfügbar',
      keyPoints: [],
      actionItems: [],
      wordCount: 0,
    };
  }

  const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const words = transcript.toLowerCase().split(/\s+/);
  
  const actionVerbs = [
    'muss', 'müssen', 'soll', 'sollte', 'erledigen', 'umsetzen',
    'erstellen', 'schicken', 'senden', 'prüfen', 'vorbereiten',
    'organisieren', 'einrichten', 'kümmere', 'übernehme', 'aufgabe', 'todo',
  ];
  const responsibilityIndicators = [
    'ich mache', 'ich kümmere', 'ich übernehme', 'du musst', 'du sollst',
    'verantwortlich', 'zuständig', 'bitte', 'kannst du', 'könntest du',
  ];
  const deadlineIndicators = [
    'bis freitag', 'bis montag', 'bis dienstag', 'bis mittwoch', 'bis donnerstag',
    'bis samstag', 'bis sonntag', 'bis morgen', 'bis heute', 'bis ende',
    'nächste woche', 'naechste woche', 'deadline', 'frist', 'bis zum',
  ];

  const actionItems = sentences.filter(s => {
    const lower = s.toLowerCase();
    const hasAction = actionVerbs.some(w => lower.includes(w));
    const hasResponsibility = responsibilityIndicators.some(w => lower.includes(w));
    const hasDeadline = deadlineIndicators.some(w => lower.includes(w));
    const score = (hasAction ? 1 : 0) + (hasResponsibility ? 1 : 0) + (hasDeadline ? 1 : 0);
    return score >= 2;
  }).slice(0, 8);

  const keyPoints = sentences
    .filter(s => s.split(/\s+/).length > 8)
    .slice(0, 6);

  const summary = sentences.length > 0 
    ? sentences.slice(0, 3).join('. ').trim() + '.'
    : 'Keine Zusammenfassung verfügbar';

  return {
    summary,
    keyPoints: keyPoints.length > 0 ? keyPoints : sentences.slice(0, 3),
    actionItems,
    wordCount: words.length,
  };
};

export const formatDuration = (seconds: number): string => {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
};

export const downloadTranscript = (meeting: {
  title: string;
  date: string;
  duration: number;
  captureMode: string;
  transcript: string;
  analysis: MeetingAnalysis;
}) => {
  const durationMin = Math.floor((meeting.duration || 0) / 60);
  const durationSec = (meeting.duration || 0) % 60;
  
  const content = `Meeting: ${meeting.title}
Datum: ${new Date(meeting.date).toLocaleString('de-DE')}
Dauer: ${durationMin}:${durationSec.toString().padStart(2, '0')} Min
Aufnahmemodus: ${meeting.captureMode === 'tab' ? 'Tab/System Audio' : 'Mikrofon'}

═══════════════════════════════════════════════════════

TRANSKRIPT:
${meeting.transcript}

═══════════════════════════════════════════════════════

ZUSAMMENFASSUNG:
${meeting.analysis.summary}

WICHTIGE PUNKTE:
${meeting.analysis.keyPoints.length > 0 ? meeting.analysis.keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n') : 'Keine wichtigen Punkte identifiziert'}

ACTION ITEMS:
${meeting.analysis.actionItems.length > 0 ? meeting.analysis.actionItems.map((a, i) => `[ ] ${i + 1}. ${a}`).join('\n') : 'Keine Action Items identifiziert'}

═══════════════════════════════════════════════════════

Statistik:
- Wörter: ${meeting.analysis.wordCount}
- Geschätzte Sprechzeit: ~${Math.floor(meeting.analysis.wordCount / 150)} Min`;

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${meeting.title.replace(/[^a-z0-9]/gi, '_')}_${new Date(meeting.date).toISOString().split('T')[0]}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
