
# Anpassung Quick-Recording: Ganzer Bildschirm und Aufnahme nur solange Mikrofon aktiv

## Was sich aendert

### 1. Ganzer Bildschirm statt Fenster
Aktuell wird `getDisplayMedia({ video: true, audio: true })` aufgerufen -- der Browser zeigt dabei einen Dialog, in dem der User zwischen "Ganzer Bildschirm", "Fenster" oder "Tab" waehlen kann. Es gibt keine Browser-API, die das auf "nur ganzer Bildschirm" erzwingen kann. Aber man kann mit `preferCurrentTab: false` und `displaySurface: 'monitor'` einen Hinweis geben, dass der ganze Bildschirm bevorzugt wird:

```ts
navigator.mediaDevices.getDisplayMedia({
  video: { displaySurface: 'monitor' },
  audio: true,
})
```

Dies sorgt dafuer, dass "Ganzer Bildschirm" im Browser-Dialog vorselektiert ist.

### 2. Aufnahme endet wenn Mikrofon-Button im Dashboard geklickt wird (nicht wenn Screen-Share endet)

Aktuell stoppt die Aufnahme automatisch, wenn der User die Bildschirmfreigabe ueber den Browser beendet (Zeile 77-79). Das soll sich aendern:

- Die Bildschirmaufnahme soll **weiterlaufen**, auch wenn der Browser-eigene "Freigabe beenden"-Button gedrueckt wird -- stattdessen wird nur der Mikrofon-Button im Header als Steuerung verwendet
- Wenn der User die Bildschirmfreigabe ueber den Browser beendet, soll die Aufnahme trotzdem gestoppt werden (Sicherheitsnetz), aber die primaere Steuerung ist der Mikrofon-Button
- Korrektur: Da der Browser die Bildschirmfreigabe bei "ended" tatsaechlich beendet und man sie nicht erzwingen kann, bleibt das `ended`-Event als Sicherheits-Fallback bestehen. Der Mikrofon-Button bleibt die Haupt-Steuerung.

## Betroffene Datei

| Datei | Aenderung |
|-------|-----------|
| `src/hooks/useQuickRecording.ts` | `displaySurface: 'monitor'` fuer Vollbild-Praeferenz; `ended`-Listener bleibt als Fallback |

## Technische Details

In `useQuickRecording.ts`, Zeile 30:
```ts
// Vorher:
navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })

// Nachher:
navigator.mediaDevices.getDisplayMedia({
  video: { displaySurface: 'monitor' } as any,
  audio: true,
})
```

Das `as any` ist noetig, weil TypeScript die `displaySurface`-Option noch nicht in allen Type-Definitionen kennt, sie wird aber von Chrome und Edge unterstuetzt.

Die restliche Logik (Mikrofon-Button startet/stoppt, Upload, Transkription) bleibt unveraendert, da sie bereits korrekt funktioniert. Der Mikrofon-Button im Header ist bereits die primaere Steuerung.
