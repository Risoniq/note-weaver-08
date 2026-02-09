

## Automatische Gesamtanalyse und erweiterte Fortschritts-Timeline

### Ueberblick
Beim Oeffnen einer Projektseite wird automatisch eine KI-Analyse gestartet (falls Recordings vorhanden und noch keine Analyse existiert). Ausserdem wird die Fortschritts-Timeline um weitere KPIs erweitert, die Qualitaet und Fortschritt besser abbilden.

### Aenderungen

| Datei | Aenderung |
|---|---|
| `src/pages/ProjectDetail.tsx` | Automatische Analyse beim Laden ausloesen (via `useEffect`), wenn Recordings vorhanden aber keine Analyse gespeichert ist |
| `src/components/projects/IFDTimeline.tsx` | Zusaetzliche Metriken pro Meeting: Dauer (Min), Teilnehmerzahl, Wortanzahl. Alle Linien im gleichen Chart mit zwei Y-Achsen (links: Anzahl, rechts: Dauer/Woerter) |

### Technische Details

**ProjectDetail.tsx -- Auto-Analyse:**
- Ein `useEffect` prueft nach dem Laden der Recordings, ob `project.analysis` leer ist und Recordings vorhanden sind
- Falls ja, wird `handleAnalyze()` automatisch aufgerufen
- Damit wird beim ersten Besuch sofort die KI-Analyse angestossen, ohne dass der User den Button klicken muss
- Der Button bleibt fuer manuelle Neuanalysen erhalten

**IFDTimeline.tsx -- Erweiterte KPIs:**
- Neue Datenpunkte pro Meeting:
  - `duration`: Dauer in Minuten (`r.duration / 60`)
  - `participants`: Anzahl Teilnehmer (aus `r.participants` oder `r.calendar_attendees`)
  - `wordCount`: Wortanzahl (`r.word_count`)
- Zwei Y-Achsen fuer bessere Lesbarkeit:
  - Linke Achse (yAxisId="left"): Action Items, Key Points, Teilnehmer
  - Rechte Achse (yAxisId="right"): Dauer (Min), Wortanzahl
- Farbkodierung:
  - Action Items: Orange
  - Key Points: Violett
  - Teilnehmer: Blau
  - Dauer: Gruen
  - Woerter: Grau

