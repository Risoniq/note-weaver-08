

# Notetaker-Speicherung auf Supabase + Audio-Upload migrieren

## Ueberblick

Der Notetaker speichert aktuell alle Meetings im Browser-localStorage. Das wird komplett auf die bestehende `recordings`-Tabelle und den `audio-uploads` Storage-Bucket umgestellt. Nach dem Speichern sind die Meetings dauerhaft in der Datenbank und erscheinen auch in der Recordings-Uebersicht.

## Daten-Mapping

```text
Meeting.id          -> recordings.id (uuid)
Meeting.title       -> recordings.title
Meeting.date        -> recordings.created_at
Meeting.transcript  -> recordings.transcript_text
Meeting.analysis    -> recordings.summary + key_points + action_items + word_count
Meeting.captureMode -> recordings.source ('notetaker_tab' / 'notetaker_mic')
Meeting.duration    -> recordings.duration
Meeting.audioBlob   -> audio-uploads/{user_id}/{recording_id}.webm
Meeting.audioUrl    -> recordings.video_url (signedUrl aus Storage)
```

## Aenderungen

### 1. `src/hooks/useMeetingStorage.ts` -- Komplett umschreiben

Statt localStorage wird der Supabase-Client verwendet:

- **loadMeetings**: `SELECT * FROM recordings WHERE source LIKE 'notetaker_%' AND user_id = auth.uid() AND deleted_at IS NULL ORDER BY created_at DESC`
- Ergebnis wird auf das `Meeting`-Interface gemappt (transcript_text -> transcript, summary/key_points/action_items -> analysis)
- **saveMeeting**:
  1. `INSERT` oder `UPSERT` in recordings-Tabelle (id, user_id, meeting_id, title, transcript_text, summary, key_points, action_items, word_count, source, duration, status)
  2. Falls audioBlob vorhanden: Upload nach `audio-uploads/{user_id}/{id}.webm`
  3. Update video_url mit signedUrl
- **deleteMeeting**: Soft-Delete (`UPDATE recordings SET deleted_at = now() WHERE id = ...`) + Storage-Datei loeschen
- **Hilfsfunktion** `getAudioUrl(userId, recordingId)`: Erzeugt eine signedUrl aus dem `audio-uploads` Bucket

### 2. `src/components/MeetingNoteTaker.tsx` -- Anpassen

- `useAuth()` importieren, um `user.id` zu bekommen
- Meeting-ID auf `crypto.randomUUID()` umstellen (statt `Date.now().toString()`)
- `meeting_id` Feld setzen (Pflichtfeld, z.B. `notetaker_${id}`)
- `user_id` beim Speichern mitsenden
- Nach Aufnahme-Stopp: Recording zuerst mit status 'processing' in DB anlegen, Audio hochladen, dann status auf 'done' setzen
- KI-Analyse-Ergebnis direkt per `saveMeeting` updaten (schreibt in recordings.summary, key_points, action_items)
- localStorage-Referenzen komplett entfernen

### 3. `src/types/meeting.ts` -- Erweitern

- `user_id?: string` hinzufuegen
- `meeting_id?: string` hinzufuegen
- `status?: string` hinzufuegen

### 4. `src/components/meeting/DownloadModal.tsx` -- Audio-URL anpassen

- Audio-Download verwendet jetzt die signedUrl aus der Datenbank (meeting.audioUrl) statt blob-URL
- Fallback: Falls audioBlob noch vorhanden (z.B. direkt nach Aufnahme), weiterhin createObjectURL verwenden

### 5. `supabase/functions/analyze-notetaker/index.ts` -- JWT-Auth hinzufuegen

- JWT aus Authorization-Header validieren (createClient mit Service Role)
- Optional: recording_id als Parameter akzeptieren und Analyse-Ergebnis direkt in die recordings-Tabelle schreiben
- Fehlende Auth = 401 zurueckgeben

### 6. Einmalige localStorage-Migration

- Beim ersten Laden von `useMeetingStorage`: pruefen ob alte `meeting:*`-Keys im localStorage existieren
- Falls ja: alle migrieren (in recordings einfuegen, Audio-Blobs falls vorhanden hochladen)
- Nach erfolgreicher Migration: localStorage-Keys loeschen
- Toast anzeigen: "X Meetings wurden in die Cloud migriert"

## Was sich NICHT aendert

- Die recordings-Tabelle (kein Schema-Update noetig, source-Feld ist bereits text)
- Der audio-uploads Bucket existiert bereits
- RLS-Policies greifen automatisch (user_id-basiert, INSERT/SELECT/UPDATE/DELETE)
- MeetingCard, MeetingDetailModal, Navigation -- nur minimale Anpassungen fuer Audio-URL
- Alle anderen Features (Bot-Aufnahmen, Kalender, Projekte) bleiben unberuehrt

## Technischer Ablauf nach Aufnahme-Stopp

```text
1. Audio-Blob erstellen
2. Recording in DB einfuegen (status: 'processing', source: 'notetaker_tab'/'notetaker_mic')
3. Audio-Blob nach audio-uploads/{user_id}/{recording_id}.webm hochladen
4. Recording updaten: video_url = signedUrl, status = 'done'
5. Download-Modal anzeigen
6. KI-Analyse im Hintergrund starten
7. Bei Erfolg: summary, key_points, action_items in recordings updaten
```

## Voraussetzungen

- Benutzer muss eingeloggt sein (useAuth wird geprueft)
- Falls nicht eingeloggt: Fehlermeldung statt Aufnahme starten

