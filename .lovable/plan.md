

# Risikoanalyse -- Aktueller Stand

## Status der bereits behobenen Risiken

| Risiko | Status |
|--------|--------|
| Datenverlust (localStorage) | Behoben -- Daten in Datenbank + Storage |
| Browser-Kompatibilitaet Speech Recognition | Behoben -- Fallback + Fehlermeldungen |
| Session-Timeout waehrend Aufnahme | Behoben -- Timer wird pausiert |

---

## Verbleibende Risiken

### HOCH -- H1: Audio-Datenverlust bei Netzwerkfehler waehrend Upload

**Problem:** Nach dem Stoppen der Aufnahme wird der Audio-Blob sofort hochgeladen. Wenn der Upload fehlschlaegt (Netzwerk weg, Timeout, Speicher voll), geht die Aufnahme verloren. Der Blob existiert nur im RAM und wird nach dem Fehler verworfen. Der User sieht nur "Meeting konnte nicht gespeichert werden."

**Auswirkung:** Komplette Aufnahme (ggf. 60+ Minuten) unwiederbringlich verloren.

**Loesung:**
- Bei Upload-Fehler: Audio-Blob temporaer in IndexedDB speichern
- Retry-Mechanismus mit exponential backoff (3 Versuche)
- Falls alle Versuche fehlschlagen: Blob in IndexedDB behalten und Download-Button anbieten
- Beim naechsten App-Start: Pruefen ob ausstehende Uploads in IndexedDB existieren und automatisch nachliefern

### HOCH -- H2: stopRecording Race Condition / Doppelaufruf

**Problem:** `stopRecording` wird sowohl manuell (Button-Klick) als auch automatisch (`audioTrack.onended`) aufgerufen. Wenn der Stream vom Browser beendet wird waehrend der User gleichzeitig auf "Beenden" klickt, wird `stopRecording` doppelt aufgerufen. Das fuehrt zu:
- Doppelter DB-Insert (gleiche Meeting-ID via `crypto.randomUUID()` zweimal generiert)
- Doppelter Audio-Upload
- Zwei DownloadModals

**Auswirkung:** Inkonsistente Daten, doppelte Eintraege, verwirrende UI.

**Loesung:**
- `useRef`-basiertes Lock (`isStoppingRef`) das sofort beim Eintritt gesetzt wird
- Meeting-ID VOR dem Stoppen generieren (beim Start der Aufnahme), nicht nachher
- `stopRecording` prueft das Lock und kehrt sofort zurueck wenn bereits aktiv

### HOCH -- H3: Signed URL mit 1-Jahr-Ablauf ohne Erneuerung

**Problem:** Audio-URLs werden als Signed URLs mit 1 Jahr Gueltigkeitsdauer gespeichert (`60 * 60 * 24 * 365`). Nach Ablauf sind die Audio-Dateien nicht mehr abrufbar, obwohl sie im Storage liegen. Es gibt keinen Mechanismus zur Erneuerung.

**Auswirkung:** Nach 1 Jahr funktioniert kein Audio-Download mehr.

**Loesung:**
- Statt Signed URL den Storage-Pfad speichern (`{user_id}/{recording_id}.webm`)
- Signed URL erst beim Abruf dynamisch generieren (kurze Gueltigkeit, z.B. 1 Stunde)
- `getAudioUrl(recordingId)` Hilfsfunktion in `useMeetingStorage` erstellen

---

### MITTEL -- M1: Kein Quota-Check vor Aufnahme

**Problem:** Der User kann eine lange Aufnahme starten, nur um am Ende beim Upload festzustellen, dass sein Speicher-Quota erschoepft ist. Verschwendete Zeit.

### MITTEL -- M2: Google Calendar OAuth Tokens in localStorage

**Problem:** Bereits als Security-Finding erkannt. OAuth-Tokens (inkl. Refresh-Token) im localStorage sind bei XSS-Angriffen angreifbar.

### MITTEL -- M3: Audio-Chunks im Speicher ohne Limit

**Problem:** `audioChunksRef` sammelt alle Audio-Chunks im RAM. Bei langen Aufnahmen (2+ Stunden) kann der Browser-Speicher volllaufen und die Tab wird gekillt.

---

### NIEDRIG -- N1: `loadMeetings` ohne Pagination

**Problem:** Alle Notetaker-Meetings werden ohne LIMIT geladen. Bei vielen Meetings wird die Abfrage langsam.

### NIEDRIG -- N2: Speech Recognition Neustart-Schleife

**Problem:** Bei `onend` wird die Recognition automatisch neu gestartet. Wenn der Neustart wiederholt fehlschlaegt, entsteht eine endlose Retry-Schleife ohne Backoff.

---

## Plan: Hochrisiken H1, H2 und H3 fixen

### Aenderung 1: `src/hooks/useIndexedDBBackup.ts` (Neue Datei)

Ein minimaler Hook fuer temporaere Audio-Speicherung in IndexedDB:
- `saveBlob(id, blob)` -- speichert einen Audio-Blob
- `getBlob(id)` -- liest einen gespeicherten Blob
- `deleteBlob(id)` -- loescht nach erfolgreichem Upload
- `getPendingIds()` -- listet alle ausstehenden Uploads

### Aenderung 2: `src/hooks/useMeetingStorage.ts`

**Signed-URL-Problem (H3) loesen:**
- `saveMeeting`: Statt Signed URL den Storage-Pfad speichern (`video_url = storage_path`)
- Neue Funktion `getAudioUrl(recordingId)`: Erzeugt bei Bedarf eine kurzlebige Signed URL (1 Stunde)
- `mapRecordingToMeeting`: Audio-URL nicht direkt aus `video_url` mappen, sondern Pfad speichern

**Upload-Retry (H1) einbauen:**
- Bei Upload-Fehler: 3 Versuche mit exponential backoff
- Falls alle fehlschlagen: Blob in IndexedDB sichern, Fehler-Status setzen

### Aenderung 3: `src/components/MeetingNoteTaker.tsx`

**Race Condition (H2) fixen:**
- Neue `isStoppingRef = useRef(false)` einfuehren
- `stopRecording`: Sofort pruefen und Lock setzen, bei Doppelaufruf abbrechen
- Meeting-ID beim Start (`startRecording`) generieren, nicht beim Stopp

**IndexedDB-Fallback (H1):**
- Nach fehlgeschlagenem Upload: Blob in IndexedDB speichern
- Download-Button in der Fehlermeldung anbieten
- Beim Mount: Pruefen ob ausstehende Uploads in IndexedDB existieren

**Audio-URL bei Wiedergabe (H3):**
- `getAudioUrl` aus `useMeetingStorage` verwenden, statt direkt `meeting.audioUrl`

### Aenderung 4: `src/components/meeting/DownloadModal.tsx`

**Audio-URL dynamisch erzeugen (H3):**
- Statt `meeting.audioUrl` direkt zu verwenden, beim Klick auf Download eine frische Signed URL generieren
- Fallback auf `meeting.audioBlob` wenn vorhanden (direkt nach Aufnahme)

### Aenderung 5: `src/components/meeting/MeetingDetailModal.tsx`

**Audio-URL dynamisch erzeugen (H3):**
- Gleiche Anpassung wie DownloadModal

## Abhaengigkeiten

```text
useIndexedDBBackup (neu)
        |
        v
useMeetingStorage (H3 + H1)
        |
        v
MeetingNoteTaker (H2 + H1 + H3)
        |
        v
DownloadModal + MeetingDetailModal (H3)
```

## Was sich NICHT aendert

- Datenbank-Schema (recordings-Tabelle bleibt gleich)
- Edge Functions (analyze-notetaker bleibt gleich)
- Session-Timeout-Logik
- Speech Recognition
- QuickRecording
- RLS Policies

