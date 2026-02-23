

# N1: Pagination fuer loadMeetings & N2: Speech Recognition Backoff

## Uebersicht

Zwei niedrige Risiken werden behoben:

1. **N1 -- Pagination**: `loadMeetings` laedt aktuell ALLE Meetings auf einmal. Bei vielen Eintraegen kann das langsam werden und das Supabase-1000-Zeilen-Limit treffen. Loesung: Pagination mit "Mehr laden"-Button.

2. **N2 -- Exponential Backoff**: Wenn die Browser-Spracherkennung wiederholt fehlschlaegt (z.B. bei Netzwerkproblemen), wird sofort endlos neu gestartet. Das kann die CPU belasten. Loesung: Wartezeiten zwischen Neustarts, die sich verdoppeln (1s, 2s, 4s, ...), und ein Maximum von 5 Versuchen bevor aufgehoert wird.

---

## Was aendert sich fuer den Nutzer?

**N1**: Statt alle Meetings auf einmal zu laden, werden zunaechst die neuesten 20 angezeigt. Am Ende der Liste erscheint ein "Mehr laden"-Button, um weitere 20 nachzuladen. Die Suche funktioniert weiterhin ueber alle geladenen Meetings.

**N2**: Bei Netzwerkproblemen waehrend der Spracherkennung wird nicht mehr endlos versucht, neu zu starten. Stattdessen wird nach 5 fehlgeschlagenen Versuchen eine Fehlermeldung angezeigt: "Spracherkennung unterbrochen -- bitte erneut starten." Der Zaehler wird bei jedem neuen manuellen Start zurueckgesetzt.

---

## Technische Details

### 1. `src/hooks/useMeetingStorage.ts` -- Pagination

- Konstante `PAGE_SIZE = 20` einfuehren
- Neuen State `hasMore` (boolean) hinzufuegen, der anzeigt ob weitere Seiten existieren
- `loadMeetings` erhaelt optionalen Parameter `append: boolean`
  - Bei `append = false` (Standard): Laedt die ersten 20, ersetzt den State
  - Bei `append = true`: Laedt die naechsten 20 ab dem aktuellen Offset, fuegt sie hinzu
- Supabase-Query bekommt `.range(offset, offset + PAGE_SIZE - 1)`
- `hasMore` wird auf `true` gesetzt wenn genau `PAGE_SIZE` Ergebnisse zurueckkommen
- Neue Funktion `loadMore` die `loadMeetings(true)` aufruft
- Rueckgabe um `hasMore` und `loadMore` erweitert

### 2. `src/components/MeetingNoteTaker.tsx` -- "Mehr laden"-Button

- `hasMore` und `loadMore` aus `useMeetingStorage` destrukturieren
- Nach der Meeting-Grid einen Button "Mehr Meetings laden" rendern, wenn `hasMore === true`
- Button laedt die naechste Seite nach

### 3. `src/hooks/useSpeechRecognition.ts` -- Exponential Backoff

- Neue Refs: `restartCountRef` (Zaehler) und `maxRestarts = 5` (Konstante)
- In `recognition.onend`: Vor dem Neustart pruefen ob `restartCountRef < maxRestarts`
  - Falls ja: Wartezeit `Math.min(1000 * 2^restartCount, 8000)` ms, dann Neustart, Zaehler erhoehen
  - Falls nein: Fehler setzen "Spracherkennung unterbrochen", `setIsActive(false)`
- Bei erfolgreichem `onresult`: `restartCountRef` auf 0 zuruecksetzen (Verbindung funktioniert wieder)
- In `startRecognition`: `restartCountRef` auf 0 zuruecksetzen

