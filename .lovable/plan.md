

## Video transkribieren und analysieren

Das Meeting "Stellantis GAV-Entwicklungs-Core-Team" hat ein Video (79 Min), aber kein Transkript, weil Recall.ai keins geliefert hat. Wir erstellen eine neue Backend-Funktion, die das Video herunterlädt, per ElevenLabs transkribiert und die KI-Analyse ausloest.

### Ablauf

1. **Neue Edge Function `transcribe-video`** erstellen:
   - Nimmt eine `recording_id` entgegen
   - Laedt die `video_url` aus der Datenbank
   - Downloadt das Video von der Recall.ai S3-URL
   - Sendet es an ElevenLabs Speech-to-Text (scribe_v2, Deutsch, mit Diarization)
   - Formatiert das Transkript mit Sprechernamen (konsistent mit bestehenden Bot-Recordings)
   - Speichert Transkript, Dauer, Wortanzahl und Teilnehmer in der `recordings`-Tabelle
   - Erstellt ein Backup in `transcript-backups` Storage
   - Triggert `analyze-transcript` fuer Summary, Key Points und Action Items

2. **Frontend-Integration**: Button "Video transkribieren" auf der Meeting-Detail-Seite anzeigen, wenn `video_url` vorhanden aber `transcript_text` leer ist.

### Technische Details

- Die Edge Function nutzt den bestehenden `ELEVENLABS_API_KEY` (bereits konfiguriert)
- ElevenLabs unterstuetzt MP4-Dateien direkt - kein Audio-Extrahieren noetig
- Maximale Dateigroesse bei ElevenLabs: 2 GB (79 Min Video ist kein Problem)
- Die Funktion authentifiziert den User und prueft Ownership (wie `sync-recording`)
- Nach erfolgreicher Transkription wird Status auf `done` belassen und `analyze-transcript` aufgerufen

### Dateien

| Datei | Aenderung |
|---|---|
| `supabase/functions/transcribe-video/index.ts` | Neue Edge Function |
| `src/pages/MeetingDetail.tsx` | Button "Video transkribieren" hinzufuegen |

