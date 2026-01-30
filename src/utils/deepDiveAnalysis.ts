// Deep Dive Analysis Utilities
// Analysiert Transkripte für Sprechanteile, offene Fragen, Small Talk und Kundenbedürfnisse

export interface SpeakerShare {
  name: string;
  words: number;
  percentage: number;
  isCustomer: boolean;
  color: string;
}

export interface OpenQuestion {
  question: string;
  speaker: string;
  lineIndex: number;
}

export interface ContentBreakdown {
  smallTalk: number;  // Prozent
  business: number;   // Prozent
  smallTalkWords: number;
  businessWords: number;
}

export interface CustomerNeed {
  need: string;
  speaker: string;
  context: string;
}

export interface DeepDiveAnalysis {
  speakerShares: SpeakerShare[];
  openQuestions: OpenQuestion[];
  contentBreakdown: ContentBreakdown;
  customerNeeds: CustomerNeed[];
}

// Farben für Sprecher
const SPEAKER_COLORS = [
  'hsl(210, 80%, 55%)',  // Blau (eigener Account)
  'hsl(150, 70%, 50%)',  // Grün
  'hsl(30, 80%, 55%)',   // Orange
  'hsl(280, 60%, 55%)',  // Lila
  'hsl(350, 70%, 55%)',  // Rot
  'hsl(180, 60%, 45%)',  // Türkis
  'hsl(60, 70%, 45%)',   // Gelb-Grün
  'hsl(320, 60%, 55%)',  // Pink
];

// Small Talk Keywords (Deutsch)
const SMALL_TALK_KEYWORDS = [
  // Begrüßung/Verabschiedung
  'hallo', 'hi', 'hey', 'guten morgen', 'guten tag', 'guten abend', 
  'tschüss', 'auf wiedersehen', 'bis dann', 'schönes wochenende',
  // Befinden
  'wie geht', 'wie gehts', 'alles klar', 'alles gut', 'wie war',
  // Wetter
  'wetter', 'regen', 'sonne', 'sonnig', 'kalt', 'warm', 'schnee',
  // Freizeit
  'wochenende', 'urlaub', 'ferien', 'feiertag', 'familie', 'kinder',
  // Allgemein
  'übrigens', 'apropos', 'nebenbei', 'ach ja', 'by the way',
];

// Bedürfnis-Phrasen (Deutsch)
const NEED_PHRASES = [
  'wir brauchen', 'wir benötigen', 'wichtig wäre', 'es wäre gut wenn',
  'können sie', 'könnten sie', 'wäre es möglich', 'hätten sie',
  'wir suchen', 'wir wollen', 'wir möchten', 'unser ziel ist',
  'das problem ist', 'die herausforderung', 'wir haben schwierigkeiten',
  'wir erwarten', 'wir hoffen', 'ideal wäre', 'am besten wäre',
  'uns fehlt', 'wir vermissen', 'was wir brauchen',
];

/**
 * Prüft ob ein Sprecher zum eigenen Account gehört
 */
const isOwnAccount = (speakerName: string, userEmail: string | null): boolean => {
  if (!userEmail) return false;
  
  const normalizedEmail = userEmail.toLowerCase();
  const normalizedName = speakerName.toLowerCase();
  
  // Prüfe ob Email-Adresse im Namen enthalten ist
  if (normalizedName.includes(normalizedEmail.split('@')[0])) return true;
  
  // Prüfe ob Teile des Namens in der Email sind
  const nameParts = normalizedName.split(/\s+/);
  const emailName = normalizedEmail.split('@')[0];
  
  return nameParts.some(part => 
    part.length > 2 && emailName.includes(part)
  );
};

// Metadaten-Felder die keine echten Sprecher sind
const METADATA_FIELDS = [
  'user-id', 'user id', 'userid',
  'user-email', 'user email', 'useremail',
  'recording-id', 'recording id', 'recordingid',
  'erstellt', 'created', 'datum', 'date',
  'meeting-info', 'meeting info',
];

/**
 * Prüft ob ein Name ein Metadaten-Feld ist (kein echter Sprecher)
 */
const isMetadataField = (name: string): boolean => {
  const normalized = name.toLowerCase().trim();
  return METADATA_FIELDS.some(field => normalized === field || normalized.includes(field));
};

/**
 * Analysiert Sprechanteile basierend auf Wortanzahl
 */
export const analyzeSpeakerShares = (
  transcript: string, 
  userEmail: string | null
): SpeakerShare[] => {
  // Entferne Metadaten-Header (alles vor dem ersten ---)
  const separatorIndex = transcript.indexOf('---');
  const cleanTranscript = separatorIndex > -1 
    ? transcript.slice(separatorIndex + 3) 
    : transcript;
  
  const lines = cleanTranscript.split('\n');
  const speakerWords: Map<string, number> = new Map();
  
  lines.forEach(line => {
    const match = line.match(/^([A-Za-zÀ-ÿ\s\-\.0-9]+?):\s(.+)/);
    if (match) {
      const speaker = match[1].trim();
      const text = match[2].trim();
      
      // Überspringe Metadaten-Felder
      if (isMetadataField(speaker)) return;
      
      const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
      
      speakerWords.set(speaker, (speakerWords.get(speaker) || 0) + wordCount);
    }
  });
  
  const totalWords = Array.from(speakerWords.values()).reduce((a, b) => a + b, 0);
  
  // Sortiere nach Wortanzahl (absteigend)
  const sortedSpeakers = Array.from(speakerWords.entries())
    .sort((a, b) => b[1] - a[1]);
  
  return sortedSpeakers.map(([name, words], index) => ({
    name,
    words,
    percentage: totalWords > 0 ? Math.round((words / totalWords) * 100) : 0,
    isCustomer: !isOwnAccount(name, userEmail),
    color: isOwnAccount(name, userEmail) ? SPEAKER_COLORS[0] : SPEAKER_COLORS[(index % (SPEAKER_COLORS.length - 1)) + 1],
  }));
};

/**
 * Findet offene Fragen im Transkript
 * Eine Frage gilt als "offen" wenn die nächste Zeile eines anderen Sprechers
 * nicht wie eine Antwort aussieht
 */
export const findOpenQuestions = (transcript: string): OpenQuestion[] => {
  const lines = transcript.split('\n').filter(l => l.trim());
  const openQuestions: OpenQuestion[] = [];
  
  lines.forEach((line, index) => {
    const match = line.match(/^([A-Za-zÀ-ÿ\s\-\.0-9]+?):\s(.+)/);
    if (!match) return;
    
    const speaker = match[1].trim();
    const text = match[2].trim();
    
    // Prüfe ob es eine Frage ist
    if (!text.includes('?')) return;
    
    // Extrahiere die Frage (letzter Satz mit Fragezeichen)
    const sentences = text.split(/(?<=[.!?])\s+/);
    const questionSentence = sentences.find(s => s.includes('?'));
    
    if (!questionSentence) return;
    
    // Prüfe ob die nächste Zeile eine Antwort ist
    const nextLine = lines[index + 1];
    if (nextLine) {
      const nextMatch = nextLine.match(/^([A-Za-zÀ-ÿ\s\-\.0-9]+?):\s(.+)/);
      if (nextMatch) {
        const nextSpeaker = nextMatch[1].trim();
        const nextText = nextMatch[2].trim().toLowerCase();
        
        // Wenn gleicher Sprecher, keine Antwort
        if (nextSpeaker === speaker) {
          openQuestions.push({
            question: questionSentence.trim(),
            speaker,
            lineIndex: index,
          });
          return;
        }
        
        // Prüfe auf typische Antwort-Indikatoren
        const answerIndicators = ['ja', 'nein', 'genau', 'richtig', 'stimmt', 'klar', 'natürlich', 'also', 'das', 'wir', 'ich'];
        const startsWithAnswer = answerIndicators.some(ind => 
          nextText.startsWith(ind + ' ') || nextText.startsWith(ind + ',') || nextText === ind
        );
        
        // Wenn die Antwort sehr kurz ist oder keine Antwort-Indikatoren hat
        if (!startsWithAnswer && nextText.split(/\s+/).length < 3) {
          openQuestions.push({
            question: questionSentence.trim(),
            speaker,
            lineIndex: index,
          });
        }
      }
    } else {
      // Letzte Zeile ist eine Frage = offen
      openQuestions.push({
        question: questionSentence.trim(),
        speaker,
        lineIndex: index,
      });
    }
  });
  
  // Limitiere auf die wichtigsten 10 offenen Fragen
  return openQuestions.slice(0, 10);
};

/**
 * Analysiert den Anteil von Small Talk vs. geschäftlichem Inhalt
 */
export const analyzeContentType = (transcript: string): ContentBreakdown => {
  const lines = transcript.split('\n').filter(l => l.trim());
  let smallTalkWords = 0;
  let businessWords = 0;
  
  lines.forEach(line => {
    const match = line.match(/^([A-Za-zÀ-ÿ\s\-\.0-9]+?):\s(.+)/);
    if (!match) return;
    
    const text = match[2].trim().toLowerCase();
    const words = text.split(/\s+/).filter(w => w.length > 0);
    
    // Prüfe ob Small Talk Keywords vorkommen
    const hasSmallTalk = SMALL_TALK_KEYWORDS.some(keyword => 
      text.includes(keyword)
    );
    
    if (hasSmallTalk) {
      smallTalkWords += words.length;
    } else {
      businessWords += words.length;
    }
  });
  
  const total = smallTalkWords + businessWords;
  
  return {
    smallTalk: total > 0 ? Math.round((smallTalkWords / total) * 100) : 0,
    business: total > 0 ? Math.round((businessWords / total) * 100) : 0,
    smallTalkWords,
    businessWords,
  };
};

/**
 * Extrahiert erkannte Kundenbedürfnisse
 * Nur von Sprechern die NICHT zum eigenen Account gehören
 */
export const extractCustomerNeeds = (
  transcript: string, 
  userEmail: string | null
): CustomerNeed[] => {
  const lines = transcript.split('\n').filter(l => l.trim());
  const needs: CustomerNeed[] = [];
  
  lines.forEach((line, index) => {
    const match = line.match(/^([A-Za-zÀ-ÿ\s\-\.0-9]+?):\s(.+)/);
    if (!match) return;
    
    const speaker = match[1].trim();
    const text = match[2].trim();
    
    // Nur Kunden-Sprecher analysieren
    if (isOwnAccount(speaker, userEmail)) return;
    
    // Suche nach Bedürfnis-Phrasen
    const lowerText = text.toLowerCase();
    
    for (const phrase of NEED_PHRASES) {
      const phraseIndex = lowerText.indexOf(phrase);
      if (phraseIndex !== -1) {
        // Extrahiere den Kontext (Rest des Satzes nach der Phrase)
        const afterPhrase = text.slice(phraseIndex + phrase.length).trim();
        const endOfSentence = afterPhrase.search(/[.!?]/);
        const needText = endOfSentence > 0 
          ? afterPhrase.slice(0, endOfSentence + 1)
          : afterPhrase.slice(0, 100);
        
        if (needText.length > 5) {
          needs.push({
            need: phrase.charAt(0).toUpperCase() + phrase.slice(1) + ' ' + needText,
            speaker,
            context: text.slice(0, 150) + (text.length > 150 ? '...' : ''),
          });
        }
        break; // Nur ein Bedürfnis pro Zeile
      }
    }
  });
  
  // Dedupliziere ähnliche Bedürfnisse
  const uniqueNeeds: CustomerNeed[] = [];
  needs.forEach(need => {
    const isDuplicate = uniqueNeeds.some(existing => 
      existing.need.toLowerCase().includes(need.need.toLowerCase().slice(0, 30)) ||
      need.need.toLowerCase().includes(existing.need.toLowerCase().slice(0, 30))
    );
    if (!isDuplicate) {
      uniqueNeeds.push(need);
    }
  });
  
  return uniqueNeeds.slice(0, 10);
};

/**
 * Führt die komplette Deep Dive Analyse durch
 */
export const performDeepDiveAnalysis = (
  transcript: string,
  userEmail: string | null
): DeepDiveAnalysis => {
  return {
    speakerShares: analyzeSpeakerShares(transcript, userEmail),
    openQuestions: findOpenQuestions(transcript),
    contentBreakdown: analyzeContentType(transcript),
    customerNeeds: extractCustomerNeeds(transcript, userEmail),
  };
};
