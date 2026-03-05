

# Fix: Aufnahme-Abbruch bei Tab-Wechsel + 2h-Limit

## Problem
Wenn der Display-Stream-Video-Track endet (z.B. Tab-Wechsel bei Fenster-Aufnahme), wird der `ended`-Event gefeuert. Der Handler prüft `mediaRecorder.state === 'recording'`, aber der MediaRecorder ist zu diesem Zeitpunkt oft schon `inactive`. Dadurch wird `stopRecording()` nie aufgerufen, aber `isRecording` bleibt `true` — Ghost-Status.

## Änderungen in `src/contexts/QuickRecordingContext.tsx`

### 1. Track-ended Handler reparieren (Zeile 239-246)
- Statt nur `stopRecording()` aufzurufen (das bei `inactive` Recorder abricht), direkt den State zurücksetzen
- Neuer Ansatz: Wenn der Track endet und der Recorder nicht mehr `recording` ist, trotzdem State cleanen und Upload auslösen

### 2. Maximale Aufnahmelänge: 2 Stunden
- Konstante `MAX_DURATION_SECONDS = 7200` (2h)
- Im Timer-Interval prüfen: wenn `elapsedSeconds >= MAX_DURATION_SECONDS`, automatisch `stopRecording()` aufrufen
- Toast-Hinweis anzeigen

### 3. stopRecording robuster machen
- Wenn `mediaRecorder.state === 'inactive'` aber `isRecording === true`: State trotzdem zurücksetzen und vorhandene Chunks verarbeiten (Upload)
- Verhindert den Ghost-Zustand komplett

| Datei | Änderung |
|---|---|
| `src/contexts/QuickRecordingContext.tsx` | Track-ended Fix, 2h-Limit, robustes stopRecording |

