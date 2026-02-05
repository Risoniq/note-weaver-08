
# Plan: Audio-Upload mit automatischer Transkription

## Uebersicht

Eine neue Funktion unter dem Meeting-Kontingent, die es Benutzern ermoeglicht, MP3- und MP4-Dateien hochzuladen. Diese werden automatisch transkribiert und als neues Meeting gespeichert.

## Architektur

```text
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend                                │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  AudioUploadCard (neue Komponente)                       │   │
│  │  - Drag & Drop Zone                                      │   │
│  │  - Datei-Validierung (MP3, MP4, max 50MB)                │   │
│  │  - Upload-Fortschritt                                    │   │
│  │  - Status-Anzeige (Uploading → Transcribing → Done)      │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase Storage                             │
│  Bucket: audio-uploads                                          │
│  Pfad: {user_id}/{recording_id}.mp3                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                Edge Function: transcribe-audio                  │
│                                                                 │
│  1. Audio von Storage abrufen                                   │
│  2. MP4 → MP3 konvertieren (via FFmpeg/externe API)             │
│  3. Transkription via ElevenLabs STT                            │
│  4. Recording mit Transkript erstellen                          │
│  5. analyze-transcript aufrufen                                 │
│  6. Status auf 'done' setzen                                    │
└─────────────────────────────────────────────────────────────────┘
```

## Benoetigte Komponenten

### 1. Neue Frontend-Komponente: AudioUploadCard

**Datei:** `src/components/upload/AudioUploadCard.tsx`

- Drag & Drop Zone mit React
- Akzeptiert: `.mp3`, `.mp4`, `.m4a`, `.wav`
- Max. Dateigroesse: 50MB (ElevenLabs Limit: 1GB, aber wir begrenzen fuer UX)
- Upload-Fortschrittsanzeige
- Status-Tracking (uploading → transcribing → analyzing → done)

### 2. Storage Bucket erstellen

**SQL Migration:**
```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('audio-uploads', 'audio-uploads', false, 52428800);

-- RLS: Nur eigene Dateien hochladen
CREATE POLICY "Users can upload audio files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'audio-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

-- RLS: Eigene Dateien lesen
CREATE POLICY "Users can read own audio files"
ON storage.objects FOR SELECT
USING (bucket_id = 'audio-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
```

### 3. Edge Function: transcribe-audio

**Datei:** `supabase/functions/transcribe-audio/index.ts`

Ablauf:
1. Authentifizierung pruefen
2. Audio-Datei von Storage abrufen
3. MP4 → MP3 Konvertierung (falls noetig)
4. ElevenLabs Speech-to-Text API aufrufen (Batch-Modus)
5. Neues Recording in DB erstellen
6. analyze-transcript Edge Function aufrufen
7. Status auf 'done' setzen

### 4. ElevenLabs API-Key

**Neues Secret erforderlich:** `ELEVENLABS_API_KEY`

Der Benutzer muss diesen Key eingeben. ElevenLabs bietet:
- Batch-Transkription mit `scribe_v2` Modell
- Speaker Diarization (verschiedene Sprecher erkennen)
- 99+ Sprachen inkl. Deutsch

## Dateistruktur der Aenderungen

```text
src/
├── components/
│   └── upload/
│       └── AudioUploadCard.tsx       # NEUE Datei
├── hooks/
│   └── useAudioUpload.ts             # NEUE Datei (Upload-Logik)
├── pages/
│   └── Index.tsx                     # Erweitern um AudioUploadCard

supabase/
├── functions/
│   └── transcribe-audio/
│       └── index.ts                  # NEUE Edge Function
├── migrations/
│   └── XXXXXX_audio_uploads_bucket.sql  # Storage Bucket

config.toml                            # Function hinzufuegen
```

## UI-Design

Die AudioUploadCard wird unter dem QuickMeetingJoin-Bereich platziert:

```text
┌──────────────────────────────────────────────────────────────┐
│  Meeting-Kontingent                                          │
│  ████████████░░░░░░░░ 12h / 20h                              │
└──────────────────────────────────────────────────────────────┘

┌─────────────────────────────┐  ┌─────────────────────────────┐
│  Bot zu Meeting senden      │  │  Account-Analyse            │
│  [Meeting-URL eingeben]     │  │  [Statistiken]              │
└─────────────────────────────┘  └─────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  📤 Audio-Datei hochladen                                    │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                                                        │  │
│  │        🎤 Datei hierher ziehen                         │  │
│  │           oder klicken zum Auswaehlen                  │  │
│  │                                                        │  │
│  │        MP3, MP4, M4A, WAV (max. 50MB)                  │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  Status: Bereit                                              │
└──────────────────────────────────────────────────────────────┘
```

## Implementierungsschritte

1. **Storage Bucket erstellen** - SQL Migration fuer audio-uploads
2. **ElevenLabs Secret** - API-Key vom Benutzer anfordern
3. **Edge Function erstellen** - transcribe-audio mit ElevenLabs STT
4. **Frontend-Komponente** - AudioUploadCard mit Upload-Logik
5. **Index.tsx anpassen** - Neue Komponente einbinden
6. **Config.toml aktualisieren** - Neue Function registrieren

## Technische Details

### MP4 zu MP3 Konvertierung

ElevenLabs unterstuetzt direkt MP4, daher ist keine Konvertierung noetig! Das STT-API extrahiert automatisch die Audio-Spur.

Unterstuetzte Formate: `mp3, mp4, m4a, wav, webm, ogg, flac`

### ElevenLabs STT Request

```typescript
const formData = new FormData();
formData.append("file", audioFile);
formData.append("model_id", "scribe_v2");
formData.append("diarize", "true");  // Sprecher erkennen
formData.append("language_code", "deu"); // Deutsch

const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
  method: "POST",
  headers: { "xi-api-key": ELEVENLABS_API_KEY },
  body: formData,
});
```

### Response-Verarbeitung

Die ElevenLabs API liefert:
```json
{
  "text": "Vollstaendiges Transkript...",
  "words": [
    { "text": "Hallo", "start": 0.0, "end": 0.5, "speaker": "Speaker 1" }
  ]
}
```

Das Transkript wird formatiert und in die `recordings`-Tabelle gespeichert.

## Kosten/Limits

- ElevenLabs STT: ~$0.20 pro Stunde Audio
- Max. Dateigroesse: 1GB (wir begrenzen auf 50MB)
- Maximale Audio-Laenge: 4.5 Stunden

## Voraussetzungen

- ElevenLabs Account mit API-Key
- Genuegend Credits bei ElevenLabs
