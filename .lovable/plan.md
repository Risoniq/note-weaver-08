

# Video-Backup in Supabase Storage (transcript-backups Bucket)

## Problem
Aktuell speichert `sync-recording` nur die Video-URL von Recall.ai in der Datenbank (`video_url`). Diese URLs sind temporaer und laufen nach einiger Zeit ab. Das Video selbst wird nicht dauerhaft gesichert.

## Loesung
Nach dem gleichen Muster wie das Transkript-Backup (Zeilen 839-873 in `sync-recording`) wird das Video von der Recall.ai-URL heruntergeladen und im bestehenden `transcript-backups` Bucket gespeichert. Die permanente Storage-URL ersetzt dann die temporaere Recall.ai-URL in der Datenbank.

## Aenderung

**Datei:** `supabase/functions/sync-recording/index.ts`

Nach dem Transkript-Backup-Block (Zeile 873) wird ein neuer Block eingefuegt, der das Video herunterlaed und in Storage speichert:

```text
Ablauf:
1. Pruefe ob eine Video-URL von Recall.ai vorhanden ist (updates.video_url)
2. Lade das Video herunter (fetch)
3. Speichere es als {userId}/{recordingId}_{timestamp}.mp4 im transcript-backups Bucket
4. Ersetze updates.video_url mit der permanenten Storage-URL
```

### Groessenbeschraenkung
- Videos werden nur gespeichert wenn sie kleiner als 500 MB sind (gleiche Grenze wie bei transcribe-video)
- Bei groesseren Dateien bleibt die temporaere Recall.ai-URL bestehen und ein Warn-Log wird geschrieben

### Storage-Pfad
Videos werden unter dem gleichen User-Ordner wie Transkripte gespeichert:
```
transcript-backups/{user_id}/{recording_id}_{timestamp}.mp4
```

### Bestehende RLS-Policies
Der `transcript-backups` Bucket ist bereits private und hat RLS-Policies, die nur authentifizierten Eigentuemern und Admins Zugriff erlauben. Da der Upload ueber den Service-Role-Key erfolgt, sind keine Policy-Aenderungen noetig.

## Betroffene Datei

| Datei | Aenderung |
|-------|-----------|
| `supabase/functions/sync-recording/index.ts` | Neuer Block nach Transkript-Backup: Video herunterladen und in Storage speichern |

## Technische Details

Der neue Code-Block wird zwischen dem Transkript-Backup (Zeile 873) und dem DB-Update (Zeile 877) eingefuegt:

```ts
// 7c. Video als Backup in Storage speichern
if (updates.video_url && typeof updates.video_url === 'string') {
  try {
    console.log('Lade Video von Recall.ai herunter fuer Backup...')
    const videoResponse = await fetch(updates.video_url)
    
    if (videoResponse.ok) {
      const contentLength = parseInt(videoResponse.headers.get('content-length') || '0')
      const maxSize = 500 * 1024 * 1024 // 500 MB
      
      if (contentLength > 0 && contentLength > maxSize) {
        console.warn(`Video zu gross fuer Backup: ${Math.round(contentLength / 1024 / 1024)}MB > 500MB`)
      } else {
        const videoBuffer = await videoResponse.arrayBuffer()
        const videoUint8Array = new Uint8Array(videoBuffer)
        
        // Groesse nochmal pruefen nach Download
        if (videoUint8Array.length <= maxSize) {
          const userId = recording.user_id || user.id
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
          const videoFileName = `${userId}/${id}_video_${timestamp}.mp4`
          
          const { data: videoUploadData, error: videoUploadError } = await supabase.storage
            .from('transcript-backups')
            .upload(videoFileName, videoUint8Array, {
              contentType: 'video/mp4',
              upsert: true
            })
          
          if (videoUploadError) {
            console.error('Video-Backup Upload Fehler:', videoUploadError)
          } else {
            console.log('Video-Backup gespeichert:', videoUploadData?.path)
            // Permanente Storage-URL in video_url speichern
            const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
            updates.video_url = `${supabaseUrl}/storage/v1/object/authenticated/transcript-backups/${videoFileName}`
            console.log('Video-URL aktualisiert auf Storage-URL')
          }
        } else {
          console.warn(`Video nach Download zu gross: ${Math.round(videoUint8Array.length / 1024 / 1024)}MB`)
        }
      }
    } else {
      console.error('Video-Download fehlgeschlagen:', videoResponse.status)
    }
  } catch (videoBackupError) {
    console.error('Video-Backup fehlgeschlagen:', videoBackupError)
  }
}
```

Die Video-URL in der Datenbank zeigt danach auf die permanente Storage-URL statt auf die temporaere Recall.ai-URL. Der Zugriff erfolgt ueber authentifizierte Requests (gleich wie bei Transkript-Backups).

