

# Bildschirmaufnahme stoppt bei Tab-Wechsel — Fix

## Problem

Zwei Ursachen:

1. **`requestAnimationFrame` pausiert im Hintergrund**: Wenn die Webcam-Compositing-Schleife (Canvas) laeuft und der User den Tab wechselt, stoppt `requestAnimationFrame` komplett. Der MediaRecorder bekommt keine neuen Frames mehr, das Video friert ein.

2. **Video-Track `ended`-Event stoppt die Aufnahme**: Zeile 234 in `QuickRecordingContext.tsx` registriert `displayStream.getVideoTracks()[0].addEventListener('ended', stopRecording)`. Chrome feuert dieses Event auch, wenn der User die Tab-Freigabe beendet oder den geteilten Tab schliesst — aber bei bestimmten Szenarien (z.B. Tab-Wechsel bei Browser-Tab-Sharing) kann der Track ebenfalls enden, was die Aufnahme ungewollt beendet.

3. **Modus-Hint vs. tatsaechliche Auswahl**: `displaySurface: 'monitor'` ist nur ein Hint fuer den Browser-Dialog. Wenn der User im Picker stattdessen einen einzelnen Tab waehlt, wird nur dieser Tab aufgenommen — nicht der gesamte Bildschirm.

## Aenderungen

### `src/contexts/QuickRecordingContext.tsx`

**A) Canvas-Loop von `requestAnimationFrame` auf `setInterval` umstellen**

Die `drawFrame`-Funktion wird statt mit `requestAnimationFrame` mit `setInterval(drawFrame, 1000/30)` (30 FPS) aufgerufen. `setInterval` laeuft im Hintergrund weiter, `requestAnimationFrame` nicht. Der Ref `animFrameRef` wird zu einem `intervalRef` (Typ `ReturnType<typeof setInterval>`).

**B) Video-Track `ended`-Handler absichern**

Statt blind `stopRecording()` aufzurufen, wird geprueft, ob der MediaRecorder noch aktiv ist und ob es sich um ein echtes Ende handelt (nicht nur ein Pause-Event). Zusaetzlich wird ein kurzer Timeout (500ms) eingebaut, damit Flicker-Events (z.B. bei Tab-Wechsel) nicht sofort die Aufnahme beenden.

**C) Timer (`setInterval` fuer Elapsed) robuster machen**

Der Timer laeuft bereits mit `setInterval` — kein Problem hier.

| Stelle | Vorher | Nachher |
|---|---|---|
| Zeile 54 | `animFrameRef = useRef<number>` | `canvasIntervalRef = useRef<ReturnType<typeof setInterval>>` |
| Zeile 70 | `cancelAnimationFrame(animFrameRef)` | `clearInterval(canvasIntervalRef)` |
| Zeile 156-194 | `requestAnimationFrame(drawFrame)` Loop | `setInterval(drawFrame, 33)` (30 FPS) |
| Zeile 234 | `addEventListener('ended', stopRecording)` | Debounced handler mit 500ms Timeout, prueft `recorder.state` |

