

## Aufnahmen-Karten: Einheitliche, kompakte Ansicht

### Ziel
Jede Aufnahme-Karte zeigt nur die wichtigsten Eckdaten - kein Inhalt (Summary, Woerter, Key Points, Action Items) mehr sichtbar.

### Was entfernt wird

- **Summary-Vorschau** (der 2-zeilige Text unter den Meta-Infos)
- **Stats-Zeile** komplett (Woerter-Anzahl, Key Points, Action Items)
- **"Meeting laeuft..." Zeile** bei aktiven Meetings

### Was bleibt

Jede Karte zeigt einheitlich:
```
[Upload-Icon] [Titel]          [Owner-Badge tuerkis] [Status-Badge]
[Kalender Datum]  [Uhr Dauer]  [Teilnehmer-Anzahl]
```

### Technische Aenderung

**RecordingCard.tsx** - Entfernen von:
1. Den `summary`-Block (Zeilen mit `recording.summary && recording.status === 'done'`)
2. Den gesamten Stats-Block (Woerter, Key Points, Action Items, Analyzing-Skeletons, "Meeting laeuft")
3. Die nicht mehr benoetigten Imports: `FileText`, `Target`, `CheckSquare`, `Loader2` (Loader2 bleibt nur fuer den Status-Badge)

Keine anderen Dateien betroffen.

