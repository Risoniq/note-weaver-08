

## Zurueck-Button auf /recordings statt / aendern

### Problem
Der Zurueck-Pfeil auf der Meeting-Detail-Seite navigiert aktuell zu `/` (Dashboard). Er soll stattdessen zu `/recordings` (Aufnahmen-Uebersicht) fuehren.

### Aenderung

**`src/pages/MeetingDetail.tsx`** (Zeile 646)
- `navigate('/')` aendern zu `navigate('/recordings')`

Das ist eine einzeilige Aenderung.

