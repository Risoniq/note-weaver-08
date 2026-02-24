
# Video wiederherstellen und permanenten Backup-Prozess reparieren

## Problem
Das Video fuer Recording `f9b14594-595e-4587-aa75-4d59db4deb4c` ist nicht dauerhaft abrufbar, weil:

1. **Video-Backup scheitert**: Der Streaming-Upload zum Storage gibt `403 "Invalid Compact JWS"` zurueck. Das liegt daran, dass S3-URLs keine HEAD-Requests unterstuetzen (403), der Fallback-Upload aber ebenfalls scheitert.
2. **UI zeigt alle S3-URLs als abgelaufen**: Die Logik in `MeetingDetail.tsx` prueft nicht, ob die URL tatsaechlich abgelaufen ist, sondern markiert pauschal alle S3-URLs als "Video-Link abgelaufen".

## Loesung

### Teil 1: Video-Backup in `sync-recording` Edge Function reparieren

**Datei: `supabase/functions/sync-recording/index.ts`**

Das Problem beim Streaming-Upload: Der Service Role Key wird als Bearer Token verwendet, aber fuer den Storage REST API Upload wird ein anderer Auth-Header benoetigt. Die Loesung:

- Statt Streaming-Upload mit `fetch()` den In-Memory-Ansatz nutzen (der ueber `supabase.storage.upload()` geht und korrekt authentifiziert)
- Den HEAD-Fallback-Pfad so aendern, dass er das Video per GET herunterlaed und dann per `supabase.storage.upload()` hochlaed (statt per raw fetch mit Bearer Token)
- Maximalgroesse fuer In-Memory auf 150 MB erhoehen (Edge Functions unterstuetzen das)

### Teil 2: S3-URL-Ablauf korrekt pruefen in `MeetingDetail.tsx`

**Datei: `src/pages/MeetingDetail.tsx`**

Statt alle S3-URLs pauschal als abgelaufen zu markieren, wird der `X-Amz-Date` und `X-Amz-Expires` Parameter aus der URL ausgelesen und mathematisch geprueft, ob die URL tatsaechlich abgelaufen ist.

Logik:
```text
X-Amz-Date = "20260224T160114Z" -> Signierungszeitpunkt
X-Amz-Expires = "21600" -> 6 Stunden Gueltigkeit
Ablauf = Signierungszeitpunkt + Gueltigkeit
Wenn jetzt < Ablauf -> URL ist gueltig, Video-Player anzeigen
Wenn jetzt >= Ablauf -> "Video erneuern" Button anzeigen
```

### Teil 3: Gleiche Logik in `RecordingViewer.tsx`

**Datei: `src/components/RecordingViewer.tsx`**

Die `isExpiredS3Url`-Funktion wird ebenfalls auf die tatsaechliche Ablaufpruefung umgestellt.

## Zusammenfassung der Aenderungen

| Datei | Aenderung |
|---|---|
| `supabase/functions/sync-recording/index.ts` | HEAD-Fallback reparieren: Video per GET laden, dann per `supabase.storage.upload()` speichern statt raw fetch |
| `src/pages/MeetingDetail.tsx` | S3-URL Ablaufzeit korrekt berechnen statt pauschal "abgelaufen" |
| `src/components/RecordingViewer.tsx` | Gleiche Ablaufpruefung einbauen |

Nach diesen Aenderungen:
- Das Video wird beim naechsten "Video erneuern" permanent gesichert
- Frische S3-URLs werden direkt als Video-Player angezeigt (statt "abgelaufen")
- Nur tatsaechlich abgelaufene URLs zeigen den Erneuerungs-Button
