

# Session-Timeout waehrend aktiver Aufnahme pausieren

## Problem

Der `useSessionTimeout`-Hook loggt den Benutzer nach 15 Minuten Inaktivitaet aus -- auch wenn gerade eine Aufnahme laeuft. Das fuehrt dazu, dass laufende Aufnahmen abgebrochen und Daten verloren gehen koennen.

## Loesung

Den `useSessionTimeout`-Hook um einen `paused`-Parameter erweitern. Wenn `paused = true`, werden alle Timer gestoppt und kein Logout durchgefuehrt. Sobald die Aufnahme endet (`paused = false`), starten die Timer neu.

## Aenderungen

### 1. `src/hooks/useSessionTimeout.ts`

- Neuen Parameter `paused?: boolean` akzeptieren
- Wenn `paused` aktiv ist:
  - Alle Timer stoppen (`clearAllTimers`)
  - Warnung ausblenden
  - Keinen Logout durchfuehren
- Wenn `paused` wieder auf `false` wechselt: Timer neu starten

```text
Vorher:  useSessionTimeout()
Nachher: useSessionTimeout({ paused?: boolean })
```

### 2. `src/components/layout/AppLayout.tsx`

- Den `isRecording`-State von `useQuickRecording` an `useSessionTimeout` weitergeben:

```text
const { isRecording } = useQuickRecording();
const { showWarning, remainingSeconds, extendSession } = useSessionTimeout({ paused: isRecording });
```

Das deckt die Schnellaufnahme ab, die direkt im AppLayout lebt.

### 3. MeetingNoteTaker (falls noch genutzt)

Der MeetingNoteTaker wird aktuell nicht mehr als Seite eingebunden -- die Aufnahmen laufen ueber `useQuickRecording` im Header. Falls der Notetaker spaeter wieder aktiviert wird, wuerde er den gleichen Mechanismus nutzen koennen (Recording-State nach oben propagieren oder ueber einen globalen Context).

## Was sich NICHT aendert

- Die Timeout-Dauer (15 Minuten) bleibt gleich
- Das Verhalten nach Ende der Aufnahme bleibt gleich (Timer startet neu)
- Die SessionTimeoutWarning-Komponente bleibt unveraendert
- Alle anderen Komponenten bleiben unberuehrt

