

# S3-URL-Erkennung im RecordingViewer ergaenzen

## Problem

Der `RecordingViewer` (Dashboard-Ansicht fuer aktive Aufnahmen) zeigt bei Status "done" direkt den Video-Player und Download-Button mit der `video_url`. Wenn das Video-Backup fehlgeschlagen ist und die URL eine abgelaufene S3-URL ist, bleibt der Player leer und der Download schlaegt fehl -- genau dasselbe Problem wie in der MeetingDetail-Seite.

## Loesung

Die gleiche S3-URL-Erkennung wie in `MeetingDetail.tsx` in den `RecordingViewer` einbauen:

### Datei: `src/components/RecordingViewer.tsx`

1. **Hilfsfunktion** `isExpiredS3Url(url)` hinzufuegen, die prueft ob die URL von S3 stammt (nicht vom eigenen Storage)
2. **Neuer State** `isRefreshingVideo` fuer den Ladezustand des Refresh-Buttons
3. **Funktion** `refreshVideoUrl()` die `sync-recording` mit `force_resync: true` aufruft und danach die Recording-Daten neu laedt
4. **UI-Anpassung** im Video-Bereich (Zeilen 220-230):
   - Wenn `isExpiredS3Url(video_url)` zutrifft: Statt des defekten Video-Players einen Hinweis anzeigen ("Video-Link abgelaufen") mit einem "Video erneuern"-Button
   - Wenn die URL eine Storage-URL ist: normaler Player wie bisher
5. **Download-Buttons** ebenfalls nur anzeigen, wenn die URL gueltig ist (keine S3-URL)

### Erkennungslogik (identisch zu MeetingDetail)

```text
isExpiredS3Url(url):
  - url enthaelt "s3.amazonaws.com" -> true
  - url enthaelt "/storage/v1/object/" -> false (eigener Storage)
  - Sonst -> false
```

### Betroffene Datei

| Datei | Aenderung |
|---|---|
| `src/components/RecordingViewer.tsx` | S3-URL-Erkennung, "Video erneuern"-Button, Refresh-Logik |

Keine Datenbank-Aenderungen noetig. Kein neuer Edge Function Code -- die bestehende `sync-recording` Funktion mit `force_resync` wird wiederverwendet.

