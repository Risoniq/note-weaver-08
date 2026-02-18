

# Proaktivitaets-Netzdiagramm: Layout und Inhalt anpassen

## Aenderungen

### 1. Layout in `ProjectDetail.tsx`

Das Proaktivitaets-Netzdiagramm wird in das bestehende 2-Spalten-Grid neben die Bereichs-Timeline verschoben, statt alleinstehend darunter zu stehen.

**Vorher:**
```
[Bereichs-Timeline              ] (volle Breite)
[SpeakerTrend] [TopicCloud]       (2-Spalten)
[ProaktivitaetsRadar             ] (volle Breite)
```

**Nachher:**
```
[Bereichs-Timeline              ] (volle Breite)
[SpeakerTrend] [TopicCloud]       (2-Spalten)
[ProaktivitaetsRadar] [???]       (oder in ein bestehendes Grid)
```

Konkret: Das Radar-Chart wird in eine zweite 2-Spalten-Reihe neben die Bereichs-Timeline gesetzt. Alternativ, da die Timeline die volle Breite nutzt, wird das Radar-Diagramm ins bestehende Grid mit SpeakerTrend und TopicCloud integriert oder ein neues 2-Spalten-Grid mit der Timeline erstellt.

Beste Loesung: Bereichs-Timeline und Proaktivitaets-Radar nebeneinander in einem 2-Spalten-Grid:

```
[Timeline]         [ProaktivitaetsRadar]  (2-Spalten)
[SpeakerTrend]     [TopicCloud]           (2-Spalten)
```

### 2. "Bereichs-Aktivitaet pro Sprecher" entfernen aus `IFDProactivityRadar.tsx`

Der gesamte Block unterhalb des Radar-Charts (Zeilen 165-201), der die farbigen Balken pro Sprecher mit Marketing/Produkt/Sales/Operations-Aufteilung anzeigt, wird entfernt. Es bleibt nur das reine Radar-Chart uebrig.

### Zusammenfassung

- **`ProjectDetail.tsx`**: Layout aendern - Timeline und Radar nebeneinander in `grid grid-cols-1 lg:grid-cols-2`
- **`IFDProactivityRadar.tsx`**: Den `speakerDomainActivity`-Abschnitt (Balken + Legende) komplett entfernen

