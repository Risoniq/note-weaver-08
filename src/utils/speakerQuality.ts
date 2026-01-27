/**
 * Sprecher-Qualitätsprüfung
 * 
 * Analysiert ob die Sprecher im Transkript sauber unterscheidbar sind.
 */

export interface SpeakerQualityResult {
  status: 'good' | 'warning' | 'critical';
  issues: string[];
  suggestions: string[];
  stats: {
    totalSpeakers: number;
    realNames: number;
    genericNames: number;  // "Sprecher X"
    unknownCount: number;  // "Unbekannt"
  };
}

/**
 * Prüft ob ein Name ein "echter" Name ist (kein generischer Fallback)
 */
const isRealName = (name: string): boolean => {
  // Generische Namen filtern
  if (name === 'Unbekannt') return false;
  if (/^Sprecher\s*\d+$/i.test(name)) return false;
  if (name.startsWith('Sprecher ')) return false;
  
  return true;
};

/**
 * Prüft ob ein Name generisch nummeriert ist
 */
const isGenericName = (name: string): boolean => {
  return /^Sprecher\s*\d+$/i.test(name);
};

/**
 * Analysiert die Qualität der Sprecherzuordnung
 */
export const analyzeSpeakerQuality = (
  speakers: string[],
  expectedCount?: number
): SpeakerQualityResult => {
  // Sprecher kategorisieren
  const realNames = speakers.filter(isRealName);
  const genericNames = speakers.filter(isGenericName);
  const unknownCount = speakers.filter(s => s === 'Unbekannt').length;
  
  const issues: string[] = [];
  const suggestions: string[] = [];
  let status: SpeakerQualityResult['status'] = 'good';
  
  // Keine Sprecher = keine Prüfung nötig
  if (speakers.length === 0) {
    return {
      status: 'good',
      issues: [],
      suggestions: [],
      stats: { totalSpeakers: 0, realNames: 0, genericNames: 0, unknownCount: 0 },
    };
  }
  
  // Kritisch: Keine echten Namen erkannt
  if (realNames.length === 0) {
    if (unknownCount > 0 && genericNames.length === 0) {
      // Alle "Unbekannt" - sehr kritisch
      status = 'critical';
      issues.push('Sprecher nicht unterscheidbar');
      suggestions.push('Klicke auf "Namen bearbeiten" um die Sprecher zu identifizieren');
    } else if (genericNames.length > 0) {
      // Nur generische Namen - moderate Warnung
      status = 'warning';
      issues.push(`${genericNames.length} Sprecher noch nicht identifiziert`);
      suggestions.push('Ordne die generischen Namen den echten Teilnehmern zu');
    }
  }
  // Warnung: Mischung aus echten und generischen Namen
  else if (genericNames.length > 0) {
    status = 'warning';
    issues.push(`${genericNames.length} von ${speakers.length} Sprechern noch nicht identifiziert`);
    suggestions.push('Ordne die verbleibenden generischen Namen zu');
  }
  
  // Hinweis: Weniger erkannte Sprecher als erwartet (z.B. aus Kalender)
  if (expectedCount && expectedCount > realNames.length && status === 'good') {
    const missing = expectedCount - realNames.length;
    status = 'warning';
    issues.push(`${missing} erwartete Teilnehmer nicht als Sprecher zugeordnet`);
    suggestions.push('Vergleiche mit der Teilnehmerliste im Kalender');
  }
  
  return {
    status,
    issues,
    suggestions,
    stats: {
      totalSpeakers: speakers.length,
      realNames: realNames.length,
      genericNames: genericNames.length,
      unknownCount,
    },
  };
};
