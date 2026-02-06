

## Ziel
Sicherstellen, dass manuelle Audio-Uploads denselben vollständigen Speicher- und Export-Workflow wie Bot-Aufnahmen durchlaufen, sodass alle Meetings konsistent in der Datenbank UND im Storage gesichert werden.

## Aktuelle Situation

### Bot-Aufnahmen (vollständig implementiert)
| Schritt | Speicherort | Status |
|---------|-------------|--------|
| Transkript | `recordings` Tabelle | ✅ |
| Transkript-Backup | `transcript-backups` Bucket | ✅ |
| KI-Analyse | `recordings` Tabelle | ✅ |
| Externer Export | via `TRANSCRIPT_EXPORT_URL` | ✅ |

### Manuelle Uploads (unvollständig)
| Schritt | Speicherort | Status |
|---------|-------------|--------|
| Audio-Datei | `audio-uploads` Bucket | ✅ |
| Transkript | `recordings` Tabelle | ✅ |
| KI-Analyse | `recordings` Tabelle | ✅ |
| Transkript-Backup | `transcript-backups` Bucket | ❌ FEHLT |
| Externer Export | via `TRANSCRIPT_EXPORT_URL` | ❌ FEHLT |

---

## Umsetzungsplan

### Schritt 1: Transkript-Backup in Storage hinzufügen

**Datei:** `supabase/functions/transcribe-audio/index.ts`

Nach dem Speichern des Transkripts in der Datenbank (Zeile ~188) wird ein Backup im `transcript-backups` Storage Bucket erstellt:

```typescript
// NEU: Transkript-Backup in Storage speichern
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFileName = `${user.id}/${recording.id}_${timestamp}.txt`;

const transcriptBackup = `[Meeting-Info]
User-ID: ${user.id}
Recording-ID: ${recording.id}
Source: manual
Erstellt: ${new Date().toISOString()}
---

${formattedTranscript.trim()}`;

const { error: backupError } = await supabaseAdmin.storage
  .from('transcript-backups')
  .upload(backupFileName, new TextEncoder().encode(transcriptBackup), {
    contentType: 'text/plain; charset=utf-8',
    upsert: true
  });

if (backupError) {
  console.warn('Backup upload failed:', backupError);
} else {
  console.log('Transcript backup saved:', backupFileName);
}
```

### Schritt 2: Externen Export hinzufügen

**Datei:** `supabase/functions/transcribe-audio/index.ts`

Nach erfolgreicher Transkription und Analyse wird das Transkript an das externe System exportiert (analog zu `sync-recording`):

```typescript
// NEU: Export an externe API senden
const exportUrl = Deno.env.get('TRANSCRIPT_EXPORT_URL');
const exportSecret = Deno.env.get('TRANSCRIPT_EXPORT_SECRET');

if (exportUrl && exportSecret) {
  console.log('Exporting transcript to external system...');
  try {
    const meetingTitle = title || audioFile.name.replace(/\.[^/.]+$/, '');
    const safeTitle = meetingTitle
      .replace(/[^a-zA-Z0-9\s\-_]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);
    
    const txtContent = `========================================
MEETING TRANSKRIPT
========================================
Titel: ${meetingTitle}
Datum: ${new Date().toLocaleString('de-DE')}
Dauer: ${Math.round(duration / 60)} Minuten
Recording ID: ${recording.id}
User ID: ${user.id}
Source: Manual Upload
========================================

${formattedTranscript.trim()}`;

    const exportPayload = {
      recording_id: recording.id,
      user_id: user.id,
      title: meetingTitle,
      safe_title: safeTitle,
      transcript_txt: txtContent,
      created_at: new Date().toISOString(),
      duration: Math.round(duration),
      metadata: {
        source: 'manual',
        word_count: wordCount,
        speaker_count: participants.length,
      }
    };

    const exportResponse = await fetch(exportUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-export-secret': exportSecret,
      },
      body: JSON.stringify(exportPayload),
    });

    if (exportResponse.ok) {
      console.log('External export successful');
    } else {
      console.warn('External export failed:', await exportResponse.text());
    }
  } catch (exportError) {
    console.warn('Export error:', exportError);
  }
}
```

### Schritt 3: Meeting-Info Header im Transkript

**Datei:** `supabase/functions/transcribe-audio/index.ts`

Das Transkript erhält denselben Header wie Bot-Aufnahmen, damit es in der Datenbank konsistent ist:

```typescript
// VOR dem Speichern in der Datenbank
const transcriptWithHeader = `[Meeting-Info]
User-ID: ${user.id}
Recording-ID: ${recording.id}
Source: manual
Erstellt: ${new Date().toISOString()}
---

${formattedTranscript.trim()}`;

// Im Update-Objekt verwenden
await supabaseAdmin
  .from('recordings')
  .update({
    transcript_text: transcriptWithHeader,
    // ... rest
  })
  .eq('id', recording.id);
```

---

## Zusammenfassung der Änderungen

| Datei | Änderung |
|-------|----------|
| `supabase/functions/transcribe-audio/index.ts` | 1. Transkript-Backup in Storage hinzufügen |
| | 2. Externen Export hinzufügen |
| | 3. Meeting-Info Header im Transkript |

---

## Ergebnis nach Implementierung

Alle manuellen Uploads werden dann identisch behandelt wie Bot-Aufnahmen:

| Speicherort | Bot-Aufnahme | Manueller Upload |
|-------------|--------------|------------------|
| `recordings` Tabelle | ✅ | ✅ |
| `transcript-backups` Bucket | ✅ | ✅ (NEU) |
| KI-Analyse in DB | ✅ | ✅ |
| Externer Export | ✅ | ✅ (NEU) |
| Audio-Original | (Recall.ai) | `audio-uploads` Bucket |

---

## Technische Details

- **Geschätzter Umfang:** ~60 Zeilen neue Code in `transcribe-audio/index.ts`
- **Keine neuen Dependencies**
- **Keine Datenbank-Änderungen**
- **Keine neuen Secrets erforderlich** (nutzt bestehende `TRANSCRIPT_EXPORT_URL` und `TRANSCRIPT_EXPORT_SECRET`)

