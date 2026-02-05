
# Plan: Verbesserung der Sprechererkennung und Teilnehmerzaehlung

## Analyse der Probleme

### Problem 1: Teilnehmer-Daten fehlen komplett
Die Datenbank zeigt `participants: null` und `calendar_attendees: null`. Das bedeutet:
- Recall.ai hat entweder keine Teilnehmerdaten geliefert
- Oder die Speicherlogik hat nicht gegriffen

### Problem 2: Namen-Inkonsistenzen
Im Transkript erscheinen:
- `Goerge, Maren (M.)` - "oe" statt "ö" (Recall.ai Transkriptions-Artefakt)
- `Beier-Nies, Katja (K.)` - korrekt aus Recall.ai, aber sie stellt sich als "Katja Bayer Nies" vor

### Problem 3: Kurze Einwuerfe werden nicht zusammengefuehrt
Die aktuelle Merge-Logik kann nur aufeinanderfolgende Segmente desselben Sprechers zusammenfuehren. Wenn Fabian mit "Ihnen" Katja unterbricht, sind das zwei verschiedene Sprecher - hier kann nicht automatisch zusammengefuehrt werden.

## Loesungsansatz

### Schritt 1: Teilnehmer aus Transkript extrahieren (Frontend-Fix)

Da `participants` null ist, muss das Frontend die Sprecher direkt aus dem Transkript-Text extrahieren. Die Funktion `extractSpeakersInOrder` in `speakerColors.ts` macht das bereits, aber sie wird nicht fuer die Teilnehmerzaehlung verwendet.

**Aenderung:** Fallback-Logik fuer Teilnehmerzaehlung, wenn `participants` null ist.

### Schritt 2: Backend-Verbesserung fuer Teilnehmer-Extraktion

Die `sync-recording` Function soll:
1. Wenn `meeting_participants` leer ist: Sprecher aus dem Transkript extrahieren
2. Diese als `participants` speichern
3. Bot-Filter anwenden (notetaker, bot, etc.)

### Schritt 3: Namen-Normalisierung

Einfuehrung einer Normalisierungsfunktion die:
- "oe", "ae", "ue" zu "ö", "ä", "ü" konvertiert (optional/heuristisch)
- Nachnamen-Vorname-Format erkennt: "Goerge, Maren (M.)" -> "Maren Görge"
- Duplikate vermeidet (gleicher Sprecher mit leicht unterschiedlichem Namen)

### Schritt 4: Intelligentere Einwurf-Behandlung (optional)

Kurze Einwuerfe (unter 3 Woerter) von anderen Sprechern koennten:
- Visuell anders dargestellt werden (kleinere Schrift, inline)
- Oder als "Zwischenruf" markiert werden

## Technische Umsetzung

### Datei 1: src/utils/participantUtils.ts

Neue Funktionen:
```text
extractParticipantsFromTranscript(transcriptText: string): Participant[]
  - Nutzt extractSpeakersInOrder aus speakerColors.ts
  - Filtert Bots heraus
  - Gibt echte Teilnehmer zurueck

normalizeGermanName(name: string): string
  - "Goerge" -> "Görge"
  - "Baier" -> "Baier" (keine Aenderung, da korrekt)
  - "Nachname, Vorname (X.)" -> "Vorname Nachname"
```

### Datei 2: supabase/functions/sync-recording/index.ts

Aenderungen:
```text
// Nach Transkript-Parsing:
if (participantsList.length === 0) {
  // Fallback: Extrahiere Sprecher aus dem formatierten Transkript
  const speakers = new Set<string>()
  mergedSegments.forEach(seg => {
    if (!isBot(seg.speaker)) {
      speakers.add(seg.speaker)
    }
  })
  
  participantsList = Array.from(speakers).map((name, idx) => ({
    id: String(idx),
    name: name
  }))
}
```

### Datei 3: Frontend - MeetingDetail.tsx oder RecordingCard.tsx

Fallback fuer Teilnehmerzaehlung:
```text
const getParticipantCount = () => {
  // Prioritaet 1: participants aus DB
  if (recording.participants?.length > 0) {
    return countRealParticipants(recording.participants)
  }
  
  // Prioritaet 2: Aus Transkript extrahieren
  if (recording.transcript_text) {
    const speakers = extractSpeakersInOrder(recording.transcript_text)
    return speakers.filter(s => !isBot(s)).length
  }
  
  return 0
}
```

## Betroffene Dateien

| Datei | Aenderung |
|-------|-----------|
| `src/utils/participantUtils.ts` | Neue Funktionen: extractParticipantsFromTranscript, normalizeGermanName |
| `supabase/functions/sync-recording/index.ts` | Fallback-Extraktion wenn participants leer |
| `src/pages/MeetingDetail.tsx` | Fallback-Teilnehmerzaehlung aus Transkript |
| `src/components/recordings/RecordingCard.tsx` | Gleiche Fallback-Logik |

## Erwartetes Ergebnis nach Re-Sync

**Sprecher im Transkript (7 Personen):**
1. Dominik Bauer
2. Fabian Becker
3. Jacqueline Gans
4. Goerge, Maren (M.) -> wird als "Maren Görge" normalisiert
5. Manske, Simone (S.) -> wird als "Simone Manske" normalisiert
6. Beier-Nies, Katja (K.) -> wird als "Katja Beier-Nies" normalisiert

**Gefiltert (keine Teilnehmer):**
- Notetaker/Bot (bereits gefiltert)

**Teilnehmerzahl:** 6 echte Personen

## Namens-Normalisierung Details

Die Namen kommen von Recall.ai im Format "Nachname, Vorname (Kuerzel)". 
Beispiel-Transformation:
```text
"Goerge, Maren (M.)" 
  -> Split bei Komma: ["Goerge", "Maren (M.)"]
  -> Vorname extrahieren: "Maren"
  -> Nachname normalisieren: "Görge" (oe -> ö)
  -> Ergebnis: "Maren Görge"

"Beier-Nies, Katja (K.)"
  -> Split bei Komma: ["Beier-Nies", "Katja (K.)"]
  -> Vorname extrahieren: "Katja"
  -> Nachname bleibt: "Beier-Nies"
  -> Ergebnis: "Katja Beier-Nies"
```

## Implementierungsreihenfolge

1. **Backend-Fix:** sync-recording Fallback-Logik fuer Teilnehmer-Extraktion
2. **Frontend-Fix:** Teilnehmerzaehlung aus Transkript wenn participants null
3. **Namen-Normalisierung:** Neue Utility-Funktion
4. **Re-Sync:** Meeting erneut synchronisieren um neue Logik anzuwenden

## Risikobewertung

| Risiko | Bewertung | Mitigation |
|--------|-----------|------------|
| Falsche Umlaut-Konvertierung | Niedrig | Nur bekannte Muster (oe->ö, ae->ä, ue->ü) |
| Doppelte Sprecher | Niedrig | Case-insensitive Deduplizierung |
| Performance | Sehr niedrig | Regex-basiert, O(n) |
