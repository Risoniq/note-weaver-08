
# Titel-Speicherung im Chat-Verlauf reparieren

## Problem

Der Titel in der Sidebar zeigt immer nur "Neuer Chat", weil `saveMessages` nie den Titel in die Datenbank schreibt. Ursache: Ein React-State-Bug.

### Ablauf des Bugs

1. User oeffnet Chat-Widget -- `activeSessionId` ist `null`
2. User sendet Nachricht -- `ensureSession()` erstellt eine neue Session und ruft `setActiveSessionId(newId)` auf
3. React hat den State-Update noch nicht verarbeitet (batching)
4. Nach dem Streaming wird `saveMessages(finalMessages)` aufgerufen
5. `saveMessages` liest `activeSessionId` aus dem Closure -- dort steht noch `null`
6. Zeile 92: `if (!activeSessionId) return;` -- Funktion bricht ab, Titel wird nie gesetzt

## Loesung

Einen `useRef` fuer die `activeSessionId` einfuehren, der immer synchron den aktuellen Wert haelt. `saveMessages` liest dann den Ref statt den State.

### Aenderungen in `src/hooks/useChatSessions.ts`

1. Neuen Ref anlegen: `const activeSessionIdRef = useRef<string | null>(null)`
2. Bei jeder Aenderung von `activeSessionId` den Ref synchron mitsetzen (kleiner `useEffect` oder direkt bei `setActiveSessionId`)
3. In `saveMessages`: statt `activeSessionId` den `activeSessionIdRef.current` lesen
4. In `setSessions`-Update innerhalb `saveMessages`: ebenfalls `activeSessionIdRef.current` verwenden

### Konkrete Code-Aenderungen

| Stelle | Was |
|---|---|
| Zeile 2 | `useRef` zum Import hinzufuegen |
| Nach Zeile 24 | `const activeSessionIdRef = useRef<string | null>(null)` anlegen |
| Alle Stellen die `setActiveSessionId(x)` aufrufen | Zusaetzlich `activeSessionIdRef.current = x` setzen (Zeilen 73, 142, 164, sowie in `clearChat`) |
| Zeile 91-110 (`saveMessages`) | `activeSessionId` durch `activeSessionIdRef.current` ersetzen und aus der Dependency-Liste entfernen |

Keine weiteren Dateien betroffen -- die Widgets rufen `saveMessages` bereits korrekt auf, der Bug liegt rein im Hook.
