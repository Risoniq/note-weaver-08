

# Fix: Meeting-Zuordnung zu Projektordnern

## Problem

Die Zuordnung von Meetings zu Projekten funktioniert teilweise nicht, weil im Code nach dem falschen Status gefiltert wird.

**Ursache**: In der Datei `AssignRecordingsDialog.tsx` (Zeile 26) wird nach `.eq("status", "completed")` gefiltert. In der Datenbank existiert dieser Status jedoch nicht -- der korrekte Wert ist `"done"`.

Dadurch erscheinen in der "Meetings zuordnen"-Liste auf der Projektseite **keine Meetings**, obwohl abgeschlossene Aufnahmen vorhanden sind.

## Loesung

### Datei: `src/components/projects/AssignRecordingsDialog.tsx`

Den Statusfilter von `"completed"` auf `"done"` aendern:

```
Vorher:  .eq("status", "completed")
Nachher: .eq("status", "done")
```

Das ist eine einzeilige Aenderung. Danach werden alle abgeschlossenen Meetings korrekt in der Zuordnungsliste angezeigt.

## Betroffene Dateien

| Datei | Aenderung |
|-------|-----------|
| `src/components/projects/AssignRecordingsDialog.tsx` | Statusfilter von `"completed"` auf `"done"` korrigieren |

## Hinweis

Die Zuordnung ueber die Meeting-Detailseite (`ProjectAssignment.tsx`) ist davon nicht betroffen -- dort wird kein Statusfilter verwendet. Das Problem betrifft nur die Zuordnung ueber die Projektseite.

