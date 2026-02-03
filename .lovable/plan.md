
## Ziel
Titeländerungen sollen **dauerhaft** gespeichert werden und sich **überall** konsistent widerspiegeln:
- Meeting-Detail Überschrift
- Transkript (in der gespeicherten `transcript_text`)
- Follow-Up Mail (neu generiert, wenn Titel geändert wurde)
- Meeting-Übersicht/Listen (Dashboard RecordingsList, RecentActivity, Transcripts)

## Was ich im Code/Backend gefunden habe (Ursachen)
1. **MeetingDetail Auto-Sync kann den Titel wieder “zurückdrehen”**
   - In `MeetingDetail.tsx` läuft ein Auto-Sync (`syncRecordingStatus`) bei pending/processing Status.
   - Die “Preserve local title”-Logik nutzt `recording.title` aus einer Closure. Wenn ein Sync kurz vor/ während der Titelbearbeitung gestartet hat, kann er danach den **alten** Titel zurückschreiben, obwohl du lokal schon den neuen gesetzt hast.

2. **Transkript wird serverseitig regelmäßig überschrieben**
   - Die Backend-Funktion `sync-recording` lädt/aktualisiert `transcript_text` (inkl. `[Meeting-Info]` Header).
   - Wenn du im Frontend einen Titel-Header in `transcript_text` schreibst, kann der beim nächsten Sync wieder verschwinden, weil `sync-recording` das Feld neu setzt.

3. **Meeting-Übersichten “Realtime”**
   - Mehrere Listen (z.B. `RecordingsList`, `RecentActivityList`, `Transcripts`) abonnieren `postgres_changes`.
   - Damit das zuverlässig live aktualisiert, muss die Tabelle `recordings` in der Realtime-Publikation sein. Wenn nicht, passiert oft “nichts”, bis man neu lädt.

## Lösung (robust & dauerhaft, für alle User)
Wir machen die Synchronisierung an die richtige Stelle:
- **Titel speichern** bleibt clientseitig (EditableTitle update der `recordings.title`).
- **Transkript-Header** wird **datenbankseitig automatisch** auf Basis von `recordings.title` gepflegt, sodass:
  - egal ob der Text vom Bot neu geschrieben wird oder ein User den Titel ändert,
  - der Titel-Header im Transkript danach immer korrekt ist.
- **MeetingDetail Auto-Sync** wird so angepasst, dass er nach einer Titeländerung **niemals** den Titel zurück überschreiben kann.
- **Listen/Übersichten** werden per Realtime/Mini-Refetch zuverlässig aktualisiert.

---

## Umsetzungsschritte (konkret)

### A) Datenbank: Trigger, der den Titel in `transcript_text` schreibt (dauerhaft)
**Warum:** Damit der Titel im Transkript immer stimmt – auch nach Bot-Syncs, Re-Sync, späteren Analysen.

1. Neue DB-Funktion (plpgsql), z.B. `apply_meeting_title_header(title, transcript_text)`:
   - Wenn `title` oder `transcript_text` null/leer ist: macht nichts oder fügt nur Header ein, wenn Transcript existiert.
   - Setzt/ersetzt einen Header ganz oben:
     - Format: `[Meeting: <Titel>]\n---\n`
   - Wichtig: Der bestehende `[Meeting-Info]` Block bleibt erhalten; wir setzen den Meeting-Header darüber oder ersetzen einen vorhandenen `[Meeting: ...]` Header.

2. Trigger auf `public.recordings`:
   - **BEFORE INSERT OR UPDATE OF title, transcript_text**
   - Setzt `NEW.transcript_text = apply_meeting_title_header(NEW.title, NEW.transcript_text)`

Ergebnis:
- Titeländerung -> Transkript wird automatisch angepasst.
- Bot schreibt neues Transkript -> Trigger sorgt dafür, dass oben wieder der aktuelle Titel steht.

### B) MeetingDetail.tsx: Race-Condition sauber beheben
**Warum:** Damit die Überschrift garantiert den neuen Titel zeigt und nicht durch Sync wieder zurückgesetzt wird.

1. Zusätzliche Refs:
   - `lastUserEditedTitleRef` (string | null)
   - `titleJustUpdatedRef` bleibt, wird aber konsequent zusammen mit `lastUserEditedTitleRef` genutzt.

2. Beim `onTitleChange(newTitle)`:
   - `titleJustUpdatedRef.current = true`
   - `lastUserEditedTitleRef.current = newTitle`
   - `setRecording(prev => ({...prev, title: newTitle}))`
   - `setCustomEmail(null)` (damit Follow-Up Mail neu generiert wird)
   - Timeout (10s) setzt `titleJustUpdatedRef.current=false` (und optional `lastUserEditedTitleRef.current=null`)

3. In `syncRecordingStatus` nach `fetchRecording()`:
   - Wenn `titleJustUpdatedRef.current` und `lastUserEditedTitleRef.current` gesetzt ist:
     - `updatedRecording.title = lastUserEditedTitleRef.current`
   - Damit kann ein alter Sync-Response den Titel nicht mehr zurückdrehen.

4. Entfernen/Reduzieren des Frontend-Workarounds, der `transcript_text` direkt beim Title-Change updated:
   - Sobald DB-Trigger aktiv ist, sollte das Frontend **nicht mehr** zusätzlich am `transcript_text` rumschreiben (sonst doppelte Header / Konflikte).
   - Das sorgt für eine Single Source of Truth.

### C) EditableTitle.tsx: Speichern bleibt optimistisch, aber Fehler sichtbar
Ihr aktueller Diff ist grundsätzlich richtig (optimistischer Callback + Rollback).
Zusätzlich plane ich:
- Beim DB-Update `update({ title: trimmedTitle || null })` ist ok.
- Falls `trimmedTitle` leer: setzen wir `null` -> Trigger kann dann optional Header entfernen oder belassen. (Entscheidung: ich würde den `[Meeting: ...]` Header entfernen, wenn title null wird.)

### D) Listen/Meeting-Übersicht: Live-Updates zuverlässig
1. DB-Migration: Realtime aktivieren
   - `ALTER PUBLICATION supabase_realtime ADD TABLE public.recordings;`
   - Dann funktionieren eure bestehenden `postgres_changes` Subscriptions in:
     - `RecordingsList.tsx`
     - `RecentActivityList.tsx`
     - `Transcripts.tsx`

2. Optional (zusätzliche Robustheit):
   - Nach erfolgreichem Titel-Speichern in `EditableTitle` kann man lokal betroffene Listen-States aktualisieren oder React Query invalidieren (falls ihr später mehr auf React Query umstellt).
   - Ist aber nicht zwingend, wenn Realtime korrekt läuft.

---

## Betroffene Dateien / Änderungen
### Backend (Migration)
- `supabase/migrations/...`
  - plpgsql Funktion `apply_meeting_title_header`
  - Trigger-Funktion + Trigger auf `recordings`
  - Realtime publication update für `recordings`

### Frontend
- `src/pages/MeetingDetail.tsx`
  - Race-condition fix mit `lastUserEditedTitleRef`
  - `customEmail` Reset bleibt
  - Frontend-Transkript-Update beim Title-Change entfernen (Trigger übernimmt)

- `src/components/recordings/EditableTitle.tsx`
  - bleibt wie im Diff (optimistisch + rollback); ggf. kleine Edge-Case-Politur (leerer Titel)

---

## Testplan (End-to-End)
1. Öffne ein Meeting `/meeting/:id`, ändere den Titel.
   - Erwartung: Überschrift aktualisiert sich sofort und bleibt nach 30s/Auto-Sync stabil.
2. Seite neu laden.
   - Erwartung: Titel ist dauerhaft gespeichert.
3. Prüfen Transkript:
   - Erwartung: `transcript_text` beginnt mit `[Meeting: Neuer Titel]` und bleibt auch nach erneutem Sync/Resync erhalten.
4. Follow-Up Mail:
   - Erwartung: Nach Titeländerung wird die Follow-Up Mail wieder aus dem neuen Titel generiert (da `customEmail` zurückgesetzt wird).
5. Meeting-Übersicht (Dashboard/Transcripts):
   - Erwartung: Titel wird nach Änderung ohne Hard-Reload aktualisiert (Realtime), spätestens nach kurzer Zeit.

---

## Risiken / Edge Cases
- Wenn ein User den Titel auf leer setzt:
  - Entscheidung im Trigger: Header entfernen oder beibehalten. Ich würde entfernen, damit kein “falscher” Titel stehen bleibt.
- Wenn `sync-recording` sehr häufig `transcript_text` überschreibt:
  - Trigger fängt das ab und setzt den Header zuverlässig nach.

