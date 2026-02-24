
# Fix: Video-Backup und abgelaufene S3-URLs dauerhaft loesen

## Problem

1. **Video-Backup scheitert**: In `sync-recording` wird vor dem Video-Download ein `HEAD`-Request gemacht, um die Dateigroesse zu pruefen. S3 pre-signed URLs von Recall.ai erlauben aber oft kein `HEAD` (nur `GET` ist signiert), was zu einem 403 fuehrt. Dadurch wird das Backup uebersprungen und die temporaere S3-URL bleibt in der Datenbank.

2. **Abgelaufene URLs im Frontend**: Wenn das Backup fehlschlaegt, zeigt die Meeting-Detail-Seite eine abgelaufene S3-URL. Der Video-Player laeuft ins Leere und der Download scheitert mit "AccessDenied / Request has expired".

## Loesung

### 1. `supabase/functions/sync-recording/index.ts` -- HEAD-Fallback

Anstatt bei einem fehlgeschlagenen HEAD-Request das Backup komplett zu ueberspringen, direkt einen GET-Request mit Streaming starten (ohne vorherige Groessenprüfung). Konkreter Ablauf:

- HEAD-Request versuchen (wie bisher)
- Bei Fehler (403/405): Direkt zum Streaming-Upload wechseln (ohne Groessenkenntnis)
- Der Streaming-Upload funktioniert ohne Groessenangabe, da er ReadableStream verwendet

```text
Aktuell:
  HEAD fehlgeschlagen -> Backup uebersprungen

Neu:
  HEAD fehlgeschlagen -> Streaming-Upload (wie bei >100MB Videos)
```

Aenderung in Zeile 890-891: Statt `console.warn` + return wird ein Fallback auf Streaming-Upload ausgefuehrt.

### 2. `src/pages/MeetingDetail.tsx` -- Abgelaufene URLs erkennen + "Video erneuern"

- Hilfsfunktion `isExpiredOrTempS3Url(url)`: Prueft ob eine URL eine S3-URL ist (nicht vom eigenen Storage stammt)
- Neuer State `isRefreshingVideo` und Funktion `refreshVideoUrl()` die `sync-recording` mit `force_resync: true` aufruft
- Im Video-Bereich: Wenn die URL eine S3-URL ist, wird ein "Video erneuern"-Button angezeigt statt eines kaputten Players
- Nach erfolgreichem Refresh wird die Seite mit der neuen (frischen) URL aktualisiert
- Optional: Automatischer Refresh-Versuch beim Laden der Seite wenn eine S3-URL erkannt wird

### 3. Ablauf nach dem Fix

```text
Sync-Recording:
  1. Recall.ai liefert frische S3-URL
  2. HEAD-Request versuchen
  3a. HEAD OK + <100MB -> In-Memory Upload
  3b. HEAD OK + >100MB -> Streaming Upload  
  3c. HEAD fehlgeschlagen (403) -> Streaming Upload (NEU)
  4. Storage-URL ersetzt S3-URL in DB
  5. Video dauerhaft verfuegbar

Frontend (MeetingDetail):
  1. Recording laden
  2. Pruefen ob video_url eine S3-URL ist
  3a. Storage-URL -> normaler Player
  3b. S3-URL -> "Video erneuern" Button anzeigen
  4. Button klickt -> sync-recording mit force_resync
  5. Nach Erfolg: Seite aktualisieren mit neuer URL
```

## Dateien

| Datei | Aenderung |
|---|---|
| `supabase/functions/sync-recording/index.ts` | Bei HEAD 403: Fallback auf Streaming-Upload statt Backup ueberspringen |
| `src/pages/MeetingDetail.tsx` | S3-URL-Erkennung, "Video erneuern"-Button, automatischer Refresh |
