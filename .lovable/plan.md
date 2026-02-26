

# Webcam-Option und Picture-in-Picture Mini-Player

## Zwei neue Features

### 1. Webcam-Checkbox im Aufnahme-Dialog

Im `RecordingModeDialog` wird unter den drei Modus-Optionen eine Checkbox hinzugefuegt: **"Eigene Kamera mit aufnehmen"**. Wenn aktiviert, wird zusaetzlich zum Display-Stream ein `getUserMedia({ video: true })` Stream geholt. Das Webcam-Video wird per Canvas-Compositing als kleines Bild (Picture-in-Picture-Stil, unten rechts) in den aufgenommenen Video-Stream eingebettet.

**Technischer Ansatz:**
- Ein unsichtbares `<canvas>` Element wird erstellt
- Per `requestAnimationFrame`-Loop wird der Display-Stream als Hintergrund und das Webcam-Video als kleines Overlay (z.B. 200x150px, unten rechts) auf das Canvas gezeichnet
- Der `canvas.captureStream()` liefert den kombinierten Video-Track fuer den MediaRecorder
- Die Webcam-Vorschau wird als kleines draggable Element im UI angezeigt waehrend der Aufnahme

### 2. Picture-in-Picture Mini-Player bei Tab-/Seitenwechsel

Wenn der Aufnahmemodus "Gesamter Bildschirm" ist und der User den Tab verlässt oder die Seite wechselt, oeffnet sich automatisch ein Browser-nativer **Picture-in-Picture** (PiP) Player. Dieser zeigt eine Live-Vorschau der Aufnahme und bleibt sichtbar ueber allen Fenstern.

**Technischer Ansatz:**
- Ein unsichtbares `<video>` Element wird mit dem Display-Stream als `srcObject` verbunden
- Bei `visibilitychange` (Tab wird unsichtbar) wird `videoElement.requestPictureInPicture()` aufgerufen
- Bei Rueckkehr zum Tab wird PiP automatisch geschlossen
- Fallback: Wenn PiP vom Browser nicht unterstuetzt wird, passiert nichts (kein Fehler)

## Betroffene Dateien

| Datei | Aenderung |
|---|---|
| `src/contexts/QuickRecordingContext.tsx` | Neuer State `includeWebcam`, Webcam-Stream-Ref, Canvas-Compositing-Logik, PiP-Video-Element-Ref, Visibility-Change-Listener |
| `src/components/recording/RecordingModeDialog.tsx` | Checkbox "Eigene Kamera mit aufnehmen" unter den Modus-Buttons, State wird an `startRecording` uebergeben |
| `src/components/recording/WebcamPreview.tsx` | NEU: Kleines Webcam-Vorschaufenster (draggable, unten rechts) waehrend der Aufnahme |

## Aenderungen im Detail

### RecordingModeDialog
- Neuer lokaler State `includeWebcam` (boolean, default false)
- Checkbox mit Label "Eigene Kamera mit aufnehmen" unterhalb der drei Modus-Buttons
- Beim Klick auf einen Modus wird `startRecording(mode, includeWebcam)` aufgerufen

### QuickRecordingContext - startRecording erweitert

```text
startRecording(mode, includeWebcam):
  1. getDisplayMedia (wie bisher)
  2. getUserMedia({ audio }) fuer Mikrofon (wie bisher)
  3. WENN includeWebcam:
     a. getUserMedia({ video: { width: 320, height: 240 } }) → webcamStream
     b. Canvas erstellen (gleiche Aufloesung wie Display-Video)
     c. requestAnimationFrame-Loop:
        - Display-Frame auf Canvas zeichnen
        - Webcam-Frame als kleines Overlay unten rechts zeichnen
     d. canvas.captureStream(30) → combinedVideoTrack
     e. MediaRecorder nutzt combinedVideoTrack statt displayStream.getVideoTracks()
  4. SONST: wie bisher (displayStream Video-Track direkt nutzen)
  5. PiP-Video-Element erstellen und mit Display-Stream verbinden
  6. visibilitychange-Listener registrieren
```

### QuickRecordingContext - PiP Logik

```text
visibilitychange Handler:
  WENN document.hidden UND isRecording UND mode === 'monitor':
    videoElement.requestPictureInPicture()
  WENN !document.hidden UND document.pictureInPictureElement:
    document.exitPictureInPicture()
```

### WebcamPreview Komponente
- Wird nur gerendert wenn `isRecording && includeWebcam`
- Zeigt den Webcam-Stream in einem kleinen Video-Element (200x150px)
- Position: fixed, bottom-right, z-index 9997
- Abgerundete Ecken, leichter Schatten
- Kann per CSS `cursor: move` verschoben werden (optional, einfache Variante ohne Drag)

### Context API Erweiterung

```text
QuickRecordingContextValue (neu):
  + includeWebcam: boolean
  + setIncludeWebcam: (v: boolean) => void
  + webcamStream: MediaStream | null  (fuer WebcamPreview)
```

### stopRecording / stopAllTracks Erweiterung
- Webcam-Stream Tracks stoppen
- Canvas-Animation-Loop abbrechen (cancelAnimationFrame)
- PiP schliessen falls aktiv
- Video-Element entfernen

