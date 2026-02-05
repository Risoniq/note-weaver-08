

# Plan: Chat-Fenster im Deep Dive vergroessern

## Aktuelles Problem

Das Chat-Fenster in der Deep Dive Analyse hat eine feste Hoehe von nur **192px** (`h-48`), was zu wenig Platz fuer laengere Konversationen bietet.

**Aktuelle Einstellung (Zeile 177):**
```tsx
<ScrollArea className="h-48 mb-3 pr-2" ref={scrollRef}>
```

## Loesung

Die Hoehe des Chat-Bereichs wird von `h-48` (192px) auf `h-80` (320px) erhoehen - fast doppelt so gross. Das bietet deutlich mehr Platz zum Lesen der Nachrichten.

## Aenderung

| Datei | Zeile | Aenderung |
|-------|-------|-----------|
| `src/components/meeting/MeetingChatWidget.tsx` | 177 | `h-48` → `h-80` |

## Vorher vs. Nachher

```text
VORHER: h-48 = 192px (ca. 4-5 Zeilen Text sichtbar)
NACHHER: h-80 = 320px (ca. 8-10 Zeilen Text sichtbar)
```

## Alternative Optionen

Falls noch mehr Platz gewuenscht ist:
- `h-96` = 384px (sehr gross)
- `min-h-80 max-h-[50vh]` = Dynamische Hoehe basierend auf Bildschirmgroesse

Die empfohlene Aenderung ist `h-80`, da sie einen guten Kompromiss zwischen Lesbarkeit und Platzbedarf im Deep Dive Sheet bietet.

