

## Problem: Meeting-Bots werden faelschlicherweise als "abgelehnt" markiert

### Ursache

Die `sync-recording` Edge Function bestimmt den Bot-Status ausschliesslich anhand des **letzten Eintrags** im `status_changes` Array von Recall.ai. Wenn ein Bot zwischenzeitlich den Status `bot_kicked_from_waiting_room` erhaelt (z.B. weil er kurz im Warteraum war), wird das Recording dauerhaft als "abgelehnt" markiert -- selbst wenn der Bot tatsaechlich im Meeting war und Aufnahmen existieren.

**Kernproblem**: Es gibt keine Pruefung, ob trotz eines Fehler-Status tatsaechlich Recordings/Transkripte bei Recall.ai vorhanden sind.

### Loesung

Die Status-Logik wird grundlegend ueberarbeitet: **Recordings haben Vorrang vor Status-Codes.** Wenn bei Recall.ai Aufnahmen existieren, wird der Bot als erfolgreich behandelt, unabhaengig vom letzten Status-Eintrag.

### Aenderungen

**1. `supabase/functions/sync-recording/index.ts` -- Status-Logik ueberarbeiten**

Aktuell (Zeilen 165-196):
```
const latestStatus = botData.status_changes?.[last]?.code
if (latestSubCode === 'bot_kicked_from_waiting_room') {
  status = 'waiting_room_rejected'  // ← Problem!
}
```

Neu:
- Nach dem Status-Mapping wird geprueft, ob `botData.recordings` existiert und Eintraege hat
- Wenn Recordings vorhanden sind UND der Status ein Fehler-Status ist (`waiting_room_rejected`, `waiting_room_timeout`, `error`), wird der Status auf `done` oder `processing` korrigiert
- Zusaetzlich: Pruefen ob der Bot jemals `in_call_recording` im status_changes Array hatte (= war tatsaechlich im Meeting)
- Logging wird erweitert, um das Ueberschreiben des Status zu dokumentieren

Neue Logik:
```
// 1. Normales Status-Mapping (wie bisher)
// 2. KORREKTUR: Wenn Recordings existieren, hat der Bot erfolgreich aufgenommen
if (['waiting_room_rejected', 'waiting_room_timeout', 'error'].includes(status)) {
  const hasRecordings = botData.recordings?.length > 0
  const wasInCall = botData.status_changes?.some(
    s => ['in_call_recording', 'in_call_not_recording', 'recording_done', 'done'].includes(s.code)
  )
  if (hasRecordings || wasInCall) {
    console.log(`Status-Korrektur: ${status} -> done (Recordings vorhanden: ${hasRecordings}, War im Call: ${wasInCall})`)
    status = 'done'
  }
}
```

**2. `supabase/functions/sync-recording/index.ts` -- Erweiterte Status-Historie-Analyse**

Statt nur den letzten Eintrag zu pruefen, wird die gesamte Status-Historie analysiert:
- War der Bot jemals `in_call_recording`? Dann war er im Meeting
- Hat der Bot `call_ended` oder `recording_done`? Dann ist die Aufnahme fertig
- Nur wenn der Bot **nie** ueber `in_waiting_room` hinausgekommen ist, wird `waiting_room_rejected` gesetzt

**3. `supabase/functions/sync-recording/index.ts` -- Robusteres Done-Check**

Aktuell wird `status === 'done'` als Bedingung fuer Media-Extraktion verwendet (Zeile 288). Neu wird auch bei korrigierten Status (`waiting_room_rejected` -> `done`) die Media-Extraktion ausgefuehrt.

**4. `supabase/functions/desktop-sdk-webhook/index.ts` -- Gleiche Korrektur**

Falls der Desktop SDK Webhook aehnliche Status-Probleme hat, wird dort die gleiche Recording-Vorrang-Logik eingebaut.

**5. `src/components/RecordingViewer.tsx` -- Polling bei Fehler-Status nicht sofort stoppen**

Aktuell stoppt das Polling bei `waiting_room_rejected` (Zeile 219). Neu:
- Bei Fehler-Status wird noch 2-3 weitere Polling-Zyklen durchgefuehrt, bevor endgueltig aufgehoert wird
- Falls sich der Status durch die Backend-Korrektur aendert, wird die Aufnahme normal weiterverarbeitet

### Zusammenfassung der Dateien

| Datei | Aenderung |
|-------|-----------|
| `supabase/functions/sync-recording/index.ts` | Status-Korrektur wenn Recordings existieren; Status-Historie-Analyse |
| `supabase/functions/desktop-sdk-webhook/index.ts` | Gleiche Recording-Vorrang-Logik |
| `src/components/RecordingViewer.tsx` | Polling bei Fehler-Status nicht sofort stoppen |

### Erwartetes Ergebnis

- Bots die tatsaechlich im Meeting waren und Aufnahmen haben, werden korrekt als "done" markiert
- Transkripte und Analysen werden auch bei zwischenzeitlichem Waiting-Room-Status erstellt
- Nur Bots die wirklich nie ins Meeting gekommen sind, werden als "abgelehnt" angezeigt

