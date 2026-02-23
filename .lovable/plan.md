

# Risikoanalyse -- Aktueller Stand

## Status der bereits behobenen Risiken

| Risiko | Status |
|--------|--------|
| Datenverlust (localStorage) | Behoben -- Daten in Datenbank + Storage |
| Browser-Kompatibilitaet Speech Recognition | Behoben -- Fallback + Fehlermeldungen |
| Session-Timeout waehrend Aufnahme | Behoben -- Timer wird pausiert |
| H1: Audio-Datenverlust bei Netzwerkfehler | Behoben -- IndexedDB Backup + Retry mit Backoff |
| H2: stopRecording Race Condition | Behoben -- isStoppingRef Lock + Meeting-ID beim Start |
| H3: Signed URL 1-Jahr-Ablauf | Behoben -- Storage-Pfad gespeichert, dynamische Signed URLs |

---

## Verbleibende Risiken

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

