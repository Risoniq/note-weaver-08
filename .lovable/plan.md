

## Verbesserung der PDF-Berichts-Qualitaet: Kreisdiagramme und Seitenumbrueche

### Probleme
1. **Kreisdiagramm-Labels** ueberlappen sich oder sind schwer lesbar, weil `labelLine={false}` gesetzt ist und die Labels direkt auf dem kleinen Kreis platziert werden
2. **Seitenumbrueche** schneiden Inhalte willkuerlich durch, weil aktuell ein einziges grosses Bild erzeugt und mechanisch in A4-Seiten zerschnitten wird
3. **Seiten werden nicht voll genutzt** -- es entstehen Leerflaechen

### Loesung

#### 1. Kreisdiagramme lesbar machen (`VisualReportView.tsx`)

- Labels von den Pie-Segmenten entfernen (`label` Prop entfernen)
- Stattdessen nur die Legende unterhalb nutzen (bereits vorhanden), die klar Farbe + Name + Prozent zeigt
- `outerRadius` von 60 auf 70 erhoehen fuer bessere Sichtbarkeit
- `innerRadius` auf 35 setzen (Donut-Stil) fuer moderneres Aussehen und bessere Lesbarkeit

#### 2. Seitenbasiertes Rendering (`VisualReportView.tsx` + `ReportDownloadModal.tsx`)

**VisualReportView.tsx:**
- Inhalt in logische Seiten-Container aufteilen, jede mit fester A4-Hoehe (1123px bei 794px Breite)
- Seite 1: Header + KPI-Karten + Charts
- Seite 2: Teilnehmer + Zusammenfassung + Key Points
- Seite 3 (falls noetig): Action Items + Kundenbeduerfnisse + Footer
- Jede Seite bekommt eine eigene `data-page` Klasse
- Innerhalb einer Seite: kein zusaetzlicher Abstand zwischen Unterpunkten
- Zwischen den Oberpunkten (Sektionen): klarer Abstand, dort darf eine neue Seite beginnen
- Footer wird auf der letzten Seite am unteren Rand platziert

**ReportDownloadModal.tsx:**
- Statt ein riesiges Canvas zu rendern und zu zerschneiden: jede Seite einzeln mit `html2canvas` erfassen
- Jede Seite wird als eigene PDF-Seite eingefuegt -- kein Abschneiden mehr
- Seiten werden vollstaendig genutzt (feste Hoehe pro Seite)

### Technischer Ansatz

```text
Seite 1 (1123px hoch, 794px breit):
+----------------------------------+
| [RISONIQ]        Meeting-Bericht |
| Titel                            |
| Datum                            |
| ──────────────────────────────── |
|                                  |
| [KPI] [KPI] [KPI] [KPI]         |
|                                  |
| [Sprechanteile]  [Business/ST]  |
| [  Donut-Chart]  [ Donut-Chart] |
| [  Legende    ]  [ Legende    ] |
|                                  |
|           (Rest auffuellen)      |
+----------------------------------+

Seite 2:
+----------------------------------+
| Teilnehmer                       |
| [Tag] [Tag] [Tag]               |
|                                  |
| Zusammenfassung                  |
| Text...                          |
|                                  |
| Key Points                       |
| 1. ...                           |
| 2. ...                           |
+----------------------------------+

Seite 3 (falls noetig):
+----------------------------------+
| To-Dos / Action Items            |
| [ ] ...                          |
|                                  |
| Kundenbeduerfnisse              |
| - ...                            |
|                                  |
|                                  |
| ──────────────────────────────── |
| Powered by RISONIQ | Datum       |
+----------------------------------+
```

### Betroffene Dateien

| Datei | Aenderung |
|-------|-----------|
| `src/components/meeting/VisualReportView.tsx` | Pie-Charts auf Donut ohne Labels umstellen, Inhalt in Seiten-Container mit fester A4-Hoehe aufteilen |
| `src/components/meeting/ReportDownloadModal.tsx` | Seiten einzeln rendern statt ein grosses Bild zu zerschneiden |

