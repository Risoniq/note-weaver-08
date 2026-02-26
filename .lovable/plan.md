

# Verbesserung der Schnellaufnahme-Funktion (Quick Recording)

## Probleme im aktuellen System

1. **Kein Auswahlmenue**: Der User kann nicht waehlen zwischen "Ganzer Bildschirm", "Fenster" oder "Tab" - es wird immer `displaySurface: 'monitor'` erzwungen
2. **Aufnahme bricht bei Tab-/Routenwechsel ab**: Die Aufnahme-State liegt im `useQuickRecording` Hook innerhalb `AppLayout` - bei Navigation wird nichts zerstoert, ABER der `MediaRecorder` koennte durch Browser-Verhalten gestoppt werden. Das eigentliche Problem: der `isRecording`-State geht verloren wenn `AppLayout` remounted
3. **Kein visueller Rahmen um den Bildschirm** waehrend der Aufnahme
4. **Roter Punkt verschwindet** bei Routenwechsel (da `isRecording` State lokal ist)
5. **Video wird als Audio hochgeladen** (an `transcribe-audio`) statt als Video gespeichert

## Loesung

### Schritt 1: Aufnahme-Auswahl-Dialog vor dem Start

Wenn der User auf das Mikrofon-Icon klickt, oeffnet sich ein kleiner Dialog/Popover mit 3 Optionen:
- **Gesamter Bildschirm** (empfohlen)
- **Anwendungsfenster**
- **Browser-Tab**

Dies wird ueber den `displaySurface`-Constraint an `getDisplayMedia` gesteuert.

### Schritt 2: Aufnahme-State globalisieren

Den Recording-State aus dem lokalen Hook in einen **React Context** (`QuickRecordingContext`) verschieben, der im Root der App (`App.tsx`) eingebunden wird. So bleibt der `isRecording`-State und die `MediaRecorder`-Referenz bei Routenwechseln erhalten.

```text
App.tsx
  └─ QuickRecordingProvider   ← NEU: haelt MediaRecorder, isRecording, refs
       └─ AppLayout
            └─ Header (liest isRecording aus Context)
            └─ Routes / Children
```

### Schritt 3: Persistenter roter Aufnahme-Balken

Ein fixierter Banner am oberen Bildschirmrand (ueber dem Header), der angezeigt wird solange `isRecording === true`. Zeigt:
- Roten Punkt (pulsierend) + "Aufnahme laeuft..."
- Laufzeit-Timer
- Stop-Button

Dieser Banner ist Teil des `QuickRecordingProvider` und rendert unabhaengig von der aktuellen Route.

### Schritt 4: Roter Bildschirmrahmen bei Vollbildaufnahme

Wenn `displaySurface === 'monitor'` gewaehlt wurde, wird ein CSS-Overlay mit einem feinen roten Rahmen (`border: 2px solid red`) ueber die gesamte Viewport-Groesse gelegt (`position: fixed, inset: 0, pointer-events: none, z-index: 9999`). Dieser verschwindet erst beim Stoppen der Aufnahme.

### Schritt 5: Video speichern und via ElevenLabs transkribieren

Aktuell wird die Aufnahme an `transcribe-audio` geschickt. Das bleibt im Prinzip gleich (ElevenLabs `scribe_v2` kann WebM-Video-Dateien verarbeiten), aber:
- Der Upload wird als Video-Datei benannt (`.webm` statt generisch)
- Das Recording wird mit `source: 'manual'` gespeichert (bereits der Fall)
- Die Videoaufnahme wird zusaetzlich in den `audio-uploads` Storage-Bucket hochgeladen und die `video_url` im Recording gesetzt, damit der User das Video spaeter abspielen kann

### Schritt 6: beforeunload-Schutz

Der `QuickRecordingProvider` registriert einen `beforeunload`-Event-Listener waehrend der Aufnahme, um versehentliches Schliessen des Tabs zu verhindern.

## Betroffene Dateien

| Datei | Aenderung |
|---|---|
| `src/contexts/QuickRecordingContext.tsx` | NEU: Context mit globalem Recording-State, MediaRecorder-Refs, Start/Stop-Logik |
| `src/hooks/useQuickRecording.ts` | Wird zum duennen Wrapper um den Context |
| `src/components/layout/AppLayout.tsx` | Nutzt Context statt lokalen Hook, rendert Recording-Banner + Rahmen |
| `src/components/recording/RecordingBanner.tsx` | NEU: Fixierter roter Banner mit Timer und Stop-Button |
| `src/components/recording/ScreenBorderOverlay.tsx` | NEU: Roter Rahmen-Overlay bei Vollbildaufnahme |
| `src/components/recording/RecordingModeDialog.tsx` | NEU: Auswahl-Dialog fuer Aufnahmemodus |
| `src/App.tsx` | QuickRecordingProvider einbinden |
| `supabase/functions/transcribe-audio/index.ts` | Video-URL im Recording speichern nach Upload |

## Technische Details

### Display Surface Mapping
```text
"monitor"  → Gesamter Bildschirm
"window"   → Anwendungsfenster  
"browser"  → Browser-Tab
```

### Context API
```text
QuickRecordingContext:
  - isRecording: boolean
  - recordingMode: 'monitor' | 'window' | 'browser' | null
  - startRecording(mode): Promise<void>
  - stopRecording(): Promise<void>
  - elapsedSeconds: number
```

### Video-URL Speicherung
Die `transcribe-audio` Edge Function wird erweitert: Nach dem Storage-Upload wird eine Signed URL generiert und als `video_url` im Recording gespeichert (Format `storage:audio-uploads:path`), sodass das Frontend das Video spaeter abspielen kann.

