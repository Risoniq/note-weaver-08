// Konsistente Farbpalette für Sprecher im Transkript
// Verwendet HSL-Farben für bessere Lesbarkeit und Konsistenz

export const SPEAKER_COLORS = [
  { bg: 'hsl(210, 90%, 95%)', text: 'hsl(210, 80%, 35%)', border: 'hsl(210, 80%, 60%)' }, // Blau
  { bg: 'hsl(150, 80%, 92%)', text: 'hsl(150, 70%, 30%)', border: 'hsl(150, 70%, 50%)' }, // Grün
  { bg: 'hsl(280, 70%, 94%)', text: 'hsl(280, 60%, 35%)', border: 'hsl(280, 60%, 55%)' }, // Lila
  { bg: 'hsl(30, 90%, 93%)', text: 'hsl(30, 80%, 35%)', border: 'hsl(30, 80%, 55%)' },    // Orange
  { bg: 'hsl(340, 80%, 94%)', text: 'hsl(340, 70%, 35%)', border: 'hsl(340, 70%, 55%)' }, // Rosa
  { bg: 'hsl(180, 70%, 92%)', text: 'hsl(180, 60%, 30%)', border: 'hsl(180, 60%, 50%)' }, // Türkis
  { bg: 'hsl(60, 80%, 92%)', text: 'hsl(60, 70%, 30%)', border: 'hsl(60, 70%, 50%)' },    // Gelb
  { bg: 'hsl(0, 70%, 94%)', text: 'hsl(0, 60%, 35%)', border: 'hsl(0, 60%, 55%)' },       // Rot
];

// Holt eine konsistente Farbe für einen Sprecher basierend auf seinem Index
export const getSpeakerColor = (speakerIndex: number) => {
  return SPEAKER_COLORS[speakerIndex % SPEAKER_COLORS.length];
};

// Erstellt eine konsistente Zuordnung von Sprechernamen zu Farben
export const createSpeakerColorMap = (speakerNames: string[]): Map<string, typeof SPEAKER_COLORS[0]> => {
  const colorMap = new Map<string, typeof SPEAKER_COLORS[0]>();
  
  speakerNames.forEach((name, index) => {
    colorMap.set(name, getSpeakerColor(index));
  });
  
  return colorMap;
};

// Extrahiert alle einzigartigen Sprecher aus einem Transkript in Reihenfolge
export const extractSpeakersInOrder = (transcript: string): string[] => {
  const speakerPattern = /^([A-Za-zÀ-ÿ\s\-\.0-9]+?):\s/gm;
  const seenSpeakers = new Set<string>();
  const orderedSpeakers: string[] = [];
  
  let match;
  while ((match = speakerPattern.exec(transcript)) !== null) {
    const name = match[1].trim();
    if (name.length >= 2 && name.length <= 50 && !seenSpeakers.has(name)) {
      seenSpeakers.add(name);
      orderedSpeakers.push(name);
    }
  }
  
  return orderedSpeakers;
};

// Formatiert ein Transkript mit farbigen Sprecher-Badges (für React-Rendering)
export interface TranscriptLine {
  speaker: string;
  text: string;
  color: typeof SPEAKER_COLORS[0];
}

export const parseTranscriptWithColors = (transcript: string): TranscriptLine[] => {
  const speakers = extractSpeakersInOrder(transcript);
  const colorMap = createSpeakerColorMap(speakers);
  
  const lines = transcript.split('\n');
  const result: TranscriptLine[] = [];
  
  let currentSpeaker = '';
  let currentText = '';
  let currentColor = SPEAKER_COLORS[0];
  
  for (const line of lines) {
    const match = line.match(/^([A-Za-zÀ-ÿ\s\-\.0-9]+?):\s(.*)$/);
    
    if (match) {
      // Vorherigen Block speichern
      if (currentSpeaker && currentText.trim()) {
        result.push({
          speaker: currentSpeaker,
          text: currentText.trim(),
          color: currentColor,
        });
      }
      
      // Neuen Block starten
      currentSpeaker = match[1].trim();
      currentText = match[2];
      currentColor = colorMap.get(currentSpeaker) || SPEAKER_COLORS[0];
    } else if (line.trim()) {
      // Zeile ohne Sprecher - zum aktuellen Text hinzufügen
      currentText += ' ' + line.trim();
    }
  }
  
  // Letzten Block speichern
  if (currentSpeaker && currentText.trim()) {
    result.push({
      speaker: currentSpeaker,
      text: currentText.trim(),
      color: currentColor,
    });
  }
  
  return result;
};
