
# Video dauerhaft in Storage sichern

## Problem

Das Video fuer Recording `f9b14594-595e-4587-aa75-4d59db4deb4c` ist nur ueber einen temporaeren S3-Link von Recall.ai verfuegbar, der nach 6 Stunden ablaeuft. Der Video-Backup-Prozess in der `sync-recording` Edge Function hat zwar den richtigen Code (In-Memory Download + `supabase.storage.upload()`), aber es gibt ein kritisches Problem:

Die gespeicherte permanente URL nutzt den `authenticated`-Pfad:
```
/storage/v1/object/authenticated/transcript-backups/...
```

Ein `<video src="...">` HTML-Tag kann **keine Authorization-Header** mitsenden. Das bedeutet: Selbst wenn das Video korrekt im Storage liegt, kann der Browser es nicht abspielen.

## Loesung

### 1. Permanente Video-URL als Signed URL speichern

**Datei: `supabase/functions/sync-recording/index.ts`** (Zeilen 878-919)

Nach dem erfolgreichen Upload wird statt der `authenticated`-URL eine **Signed URL** mit langer Laufzeit (z.B. 1 Jahr) generiert und in der Datenbank gespeichert. Alternativ kann der Storage-Pfad (ohne URL-Praefix) gespeichert werden und das Frontend generiert on-demand Signed URLs.

Gewaehlter Ansatz: **Storage-Pfad speichern** (z.B. `704551d2.../f9b14594_video_2026-02-24.mp4`), damit das Frontend flexibel Signed URLs erzeugen kann.

### 2. Frontend: Signed URL on-demand generieren

**Datei: `src/pages/MeetingDetail.tsx`**

Wenn die `video_url` ein Supabase Storage-Pfad ist (kein `http`-Praefix), wird per `supabase.storage.from('transcript-backups').createSignedUrl(path, 3600)` eine gueltige URL fuer den Video-Player erzeugt.

**Datei: `src/components/RecordingViewer.tsx`**

Gleiche Logik fuer die RecordingViewer-Komponente.

### 3. Sofortige Wiederherstellung dieses Videos

Nach dem Deploy der Edge Function wird ein `force_resync` fuer das betroffene Recording ausgeloest, damit das Video heruntergeladen und permanent gesichert wird.

## Technische Details

### sync-recording/index.ts - Aenderung (Zeile ~907)

Vorher:
```typescript
updates.video_url = `${supabaseUrl}/storage/v1/object/authenticated/transcript-backups/${videoFileName}`
```

Nachher:
```typescript
// Nur den Storage-Pfad speichern - Frontend generiert Signed URLs
updates.video_url = `storage:transcript-backups:${videoFileName}`
```

Das `storage:`-Praefix signalisiert dem Frontend, dass es eine Signed URL erzeugen muss.

### MeetingDetail.tsx und RecordingViewer.tsx - Neue Logik

```typescript
// Erkennung und Aufloesung von Storage-Pfaden
const resolveVideoUrl = async (url: string): Promise<string> => {
  if (url.startsWith('storage:')) {
    const [, bucket, ...pathParts] = url.split(':');
    const path = pathParts.join(':');
    const { data } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 3600); // 1 Stunde
    return data?.signedUrl || url;
  }
  // Auch bestehende authenticated-URLs aufloesen
  if (url.includes('/storage/v1/object/authenticated/')) {
    const match = url.match(/\/storage\/v1\/object\/authenticated\/([^/]+)\/(.+)/);
    if (match) {
      const { data } = await supabase.storage
        .from(match[1])
        .createSignedUrl(match[2], 3600);
      return data?.signedUrl || url;
    }
  }
  return url;
};
```

### isExpiredS3Url - Anpassung

Storage-Pfade (`storage:...`) und authentifizierte URLs werden nicht als "abgelaufen" markiert, sondern als "aufloesbar" behandelt.

## Zusammenfassung der Aenderungen

| Datei | Aenderung |
|---|---|
| `supabase/functions/sync-recording/index.ts` | Video-URL als Storage-Pfad speichern statt authenticated URL |
| `src/pages/MeetingDetail.tsx` | Signed URL on-demand generieren fuer Storage-Pfade |
| `src/components/RecordingViewer.tsx` | Gleiche Signed-URL-Logik |

Nach diesen Aenderungen:
- Videos werden permanent im Storage gesichert
- Der Browser kann Videos ueber kurzlebige Signed URLs abspielen
- Bestehende S3-URLs funktionieren weiterhin solange sie gueltig sind
- "Video erneuern" laedt das Video herunter und sichert es permanent
