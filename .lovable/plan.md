

# Video-Backup fuer grosse Dateien verbessern

## Aktuelle Situation

- Videos bis 50 MB werden in den Supabase Storage (`transcript-backups` Bucket) heruntergeladen und gespeichert
- Videos ueber 50 MB behalten die temporaere Recall.ai-URL (die nach einigen Tagen ablaeuft)
- Edge Functions haben ca. 150 MB RAM-Limit

## Warum kein Runterskalieren?

Video-Transkodierung (z.B. Aufloesung reduzieren, Bitrate senken) benoetigt `ffmpeg` oder aehnliche Tools. Diese sind in Edge Functions (Deno-basiert) **nicht verfuegbar** -- es gibt keinen Zugriff auf native Binaries. Runterskalieren ist daher technisch nicht moeglich innerhalb der Edge Function.

## Loesung: Limit erhoehen + Streaming fuer groessere Videos

### Schritt 1: Limit auf 100 MB erhoehen
Edge Functions haben ~150 MB RAM. Mit Overhead fuer JSON-Parsing, Transkript-Verarbeitung etc. sind ~100 MB fuer den Video-Download sicher machbar. Das deckt die meisten Meetings ab (1 Stunde Meeting = ca. 50-80 MB bei Standard-Qualitaet).

**Datei:** `supabase/functions/sync-recording/index.ts` (Zeile 882)

```
// Vorher:
const maxMemorySize = 50 * 1024 * 1024 // 50 MB

// Nachher:
const maxMemorySize = 100 * 1024 * 1024 // 100 MB
```

### Schritt 2: Fuer Videos ueber 100 MB -- Streaming-Upload ohne RAM-Belastung

Statt das gesamte Video in den Speicher zu laden, wird der Download-Stream direkt an den Supabase Storage weitergeleitet. Das funktioniert, indem der `ReadableStream` von `fetch()` direkt als Body an den Storage-Upload gesendet wird. Dadurch wird das Video nie vollstaendig im RAM gehalten.

**Datei:** `supabase/functions/sync-recording/index.ts` (Abschnitt 7c, Zeilen 875-927)

Die Logik wird erweitert:
- Videos bis 100 MB: wie bisher (ArrayBuffer-Download + Upload)
- Videos ueber 100 MB: Streaming-Upload ueber die Supabase Storage REST API mit dem Request-Body als Stream
- Kein Content-Length noetig fuer den Upload -- Supabase akzeptiert chunked transfers

### Ablauf fuer grosse Videos (ueber 100 MB)

```text
Recall.ai Video-URL
    |
    v
fetch(videoUrl) --> ReadableStream (nicht .arrayBuffer()!)
    |
    v
fetch(storageUploadUrl, { body: stream }) --> Supabase Storage
    |
    v
video_url in DB aktualisiert auf permanente Storage-URL
```

## Betroffene Datei

| Datei | Aenderung |
|-------|-----------|
| `supabase/functions/sync-recording/index.ts` | Limit auf 100 MB erhoehen, Streaming-Upload fuer Videos ueber 100 MB hinzufuegen |

## Ergebnis

- Videos bis 100 MB: wie bisher (In-Memory, schnell)
- Videos ueber 100 MB: Streaming-Upload (kein RAM-Problem, etwas langsamer)
- Kein Video geht mehr verloren durch ablaufende Recall.ai-URLs

