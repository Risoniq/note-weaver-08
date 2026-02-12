

## Owner-Badge neben Status anzeigen (tuerkis)

### Aenderung

In `RecordingCard.tsx` wird die `ownerEmail` als tuerkisfarbener Badge direkt neben dem Status-Badge (rechts oben) angezeigt, statt in der Meta-Zeile darunter.

### Details

**RecordingCard.tsx** - Eine Aenderung:

1. Die `ownerEmail`-Anzeige wird aus der Meta-Zeile (Datum/Dauer/Teilnehmer) entfernt
2. Stattdessen wird sie als Badge mit `bg-primary/20 text-primary` (tuerkis, passend zur bestehenden Primaerfarbe des Projekts) neben dem Status-Badge im Header-Bereich platziert
3. Das User-Icon bleibt erhalten, der Badge erscheint links vom Status-Badge

Layout vorher:
```
[Titel]                              [Status-Badge]
[Datum] [Dauer] [Owner] [Teilnehmer]
```

Layout nachher:
```
[Titel]                   [Owner-Badge tuerkis] [Status-Badge]
[Datum] [Dauer] [Teilnehmer]
```

### Technisch

- Farbe: `bg-primary/15 text-primary border-primary/30` - nutzt die bestehende tuerkise Primaerfarbe (HSL 187)
- Nur sichtbar wenn `ownerEmail` gesetzt ist (Admin/Team-Ansicht)
- Keine weiteren Dateien betroffen

