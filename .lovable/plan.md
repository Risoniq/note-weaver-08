

# Risikoanalyse komplett entfernen

## Ueberblick

Die Risikoanalyse wird vollstaendig aus dem Notetaker entfernt -- keine KI-Generierung, keine Anzeige, kein Download. Das betrifft 5 Dateien.

## Aenderungen

### 1. `src/types/meeting.ts`
- Das komplette `RiskItem`-Interface entfernen
- Das Feld `risks?: RiskItem[]` aus `MeetingAnalysis` entfernen

### 2. `supabase/functions/analyze-notetaker/index.ts`
- Den `risks`-Teil aus dem Tool-Call-Schema entfernen (properties und required)
- Die `risks`-Zuweisung aus der Antwort entfernen
- Den System-Prompt vereinfachen (keine Risiko-Anweisungen mehr)

### 3. `src/components/meeting/MeetingDetailModal.tsx`
- Den kompletten "Risikoanalyse"-Abschnitt (ca. 40 Zeilen) entfernen
- Die Imports `AlertTriangle` und `Shield` entfernen
- Den Import von `RiskItem` entfernen

### 4. `src/utils/meetingAnalysis.ts`
- Den `risksSection`-Block aus der `downloadTranscript`-Funktion entfernen
- Die Referenz auf `risks` im Download-Text entfernen

### 5. `src/components/MeetingNoteTaker.tsx`
- Die Toast-Nachricht anpassen: "Zusammenfassung und Action Items wurden erstellt" (ohne "Risikoanalyse")

## Was nicht betroffen ist

- Speicherlogik (`useMeetingStorage`) -- arbeitet generisch mit JSON, keine Aenderung noetig
- Alte Meetings im localStorage mit `risks`-Daten funktionieren weiterhin (Feld wird einfach ignoriert)
- Alle anderen Features (Aufnahme, Transkription, Download, Kalender) bleiben unberuehrt

