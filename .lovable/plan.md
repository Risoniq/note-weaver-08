
# Automatische Sprecher-Qualitaetspruefung

## Uebersicht

Bei jedem Meeting soll automatisch geprueft werden, ob eine saubere Unterscheidung zwischen den Sprechern besteht. Falls Probleme erkannt werden (z.B. alle Sprecher heissen "Unbekannt" oder es gibt nur generische Namen wie "Sprecher 1"), wird dem Benutzer eine Warnung angezeigt mit Handlungsempfehlungen.

## Analyse-Logik

Die Sprecher-Qualitaet wird anhand folgender Kriterien bewertet:

| Problem | Beschreibung | Schweregrad |
|---------|--------------|-------------|
| Alle "Unbekannt" | Alle Sprecher heissen "Unbekannt" | Kritisch |
| Nur generische Namen | Nur "Sprecher 1", "Sprecher 2", etc. | Warnung |
| Mischung | Echte Namen + generische Namen | Hinweis |
| Erwartung nicht erfuellt | Weniger Sprecher erkannt als erwartet (vs. Kalender-Teilnehmer) | Hinweis |

## Loesung

### 1. Neue Utility-Funktion: `analyzeSpeakerQuality`

**Datei:** `src/utils/speakerQuality.ts` (neue Datei)

```typescript
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

export const analyzeSpeakerQuality = (
  speakers: string[],
  expectedCount?: number
): SpeakerQualityResult => {
  // Kategorisiere Sprecher
  const realNames = speakers.filter(s => 
    !s.startsWith('Sprecher ') && 
    s !== 'Unbekannt' &&
    !s.match(/^Sprecher\s*\d+$/i)
  );
  const genericNames = speakers.filter(s => s.match(/^Sprecher\s*\d+$/i));
  const unknownCount = speakers.filter(s => s === 'Unbekannt').length;
  
  const issues: string[] = [];
  const suggestions: string[] = [];
  let status: 'good' | 'warning' | 'critical' = 'good';
  
  // Pruefe auf kritische Probleme
  if (speakers.length > 0 && realNames.length === 0) {
    if (unknownCount > 0 || genericNames.length > 0) {
      status = 'critical';
      issues.push('Keine echten Sprechernamen erkannt');
      suggestions.push('Klicke auf "Namen bearbeiten" um Sprecher zu identifizieren');
    }
  }
  
  // Pruefe auf Warnungen
  if (genericNames.length > 0 && realNames.length > 0) {
    status = status === 'critical' ? 'critical' : 'warning';
    issues.push(`${genericNames.length} Sprecher noch nicht identifiziert`);
    suggestions.push('Ordne die generischen Namen den echten Teilnehmern zu');
  }
  
  // Pruefe Erwartung
  if (expectedCount && realNames.length < expectedCount) {
    const missing = expectedCount - realNames.length;
    issues.push(`${missing} erwartete Teilnehmer nicht zugeordnet`);
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
```

### 2. Neue Komponente: `SpeakerQualityBanner`

**Datei:** `src/components/transcript/SpeakerQualityBanner.tsx` (neue Datei)

Eine Banner-Komponente, die Warnungen anzeigt:

- **Kritisch (rot):** "Sprecher nicht unterscheidbar - bitte Namen zuordnen"
- **Warnung (gelb):** "X von Y Sprechern noch nicht identifiziert"  
- **Hinweis (blau):** "Kalender zeigt mehr Teilnehmer als erkannt"

Mit einem Button der direkt zum "Namen bearbeiten" Modus wechselt.

### 3. Integration in MeetingDetail

**Datei:** `src/pages/MeetingDetail.tsx`

Die Qualitaetspruefung wird automatisch beim Laden des Meetings ausgefuehrt. Das Banner erscheint oberhalb des Transkripts, wenn Probleme erkannt werden.

```text
+------------------------------------------+
|  [!] 2 Sprecher noch nicht identifiziert |
|      Klicke hier um Namen zuzuordnen     |
+------------------------------------------+
|  Transkript                              |
|  ...                                     |
+------------------------------------------+
```

## Benutzer-Flow

1. Meeting-Detail Seite wird geladen
2. Sprecher werden aus Transkript extrahiert
3. Qualitaetspruefung wird automatisch durchgefuehrt
4. Bei Problemen: Banner erscheint mit klarer Handlungsanweisung
5. Benutzer klickt auf Banner -> "Namen bearbeiten" Modus startet automatisch

## Betroffene Dateien

| Datei | Aenderung |
|-------|-----------|
| `src/utils/speakerQuality.ts` | Neue Datei mit Analyse-Logik |
| `src/components/transcript/SpeakerQualityBanner.tsx` | Neue Banner-Komponente |
| `src/pages/MeetingDetail.tsx` | Integration der Qualitaetspruefung und Banner |

## Technische Details

### Sprecher-Kategorisierung

```text
"Dominik Bauer"    -> realName (echter Name)
"Sforzin, Marco"   -> realName (echter Name mit Komma)
"Sprecher 1"       -> genericName (automatisch nummeriert)
"Sprecher 2"       -> genericName
"Unbekannt"        -> unknown (nicht unterscheidbar)
```

### Banner-Styling

- Kritisch: `bg-destructive/10 border-destructive text-destructive`
- Warnung: `bg-warning/10 border-warning text-warning-foreground`
- Hinweis: `bg-primary/10 border-primary text-primary`

### Automatisches Ausblenden

Das Banner wird ausgeblendet, wenn:
- Alle Sprecher echte Namen haben
- Der Benutzer die Warnung bereits im Edit-Modus bearbeitet
