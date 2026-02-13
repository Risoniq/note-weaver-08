

## Bericht-Export als visuellen Report (statt TXT)

### Ziel
Der "Bericht herunterladen" Button soll nicht mehr eine reine TXT/Markdown-Datei erzeugen, sondern einen visuell aufbereiteten Report im gleichen Design wie die Dashboard-Analyse -- mit Pie-Charts, KPI-Karten, farbiger Darstellung und professionellem Layout. Der Report wird als PDF heruntergeladen.

### Ansatz
Ein neues Browser-Fenster mit einer druckoptimierten HTML-Seite oeffnen, die alle Analyse-Visualisierungen rendert. Der User kann dann ueber den Browser-Druckdialog als PDF speichern. Zusaetzlich wird `html2canvas` + `jsPDF` eingebaut fuer einen direkten PDF-Download.

### Neue Abhaengigkeiten
- `html2canvas` -- Rendert HTML-Elemente als Canvas/Bild
- `jspdf` -- Erzeugt PDF-Dateien im Browser

### Aenderungen

**1. Neue Komponente: `src/components/meeting/VisualReportView.tsx`**
- Rendert eine druckoptimierte Version der Meeting-Analyse
- Enthaelt:
  - Header mit Titel, Datum, Dauer, Teilnehmeranzahl
  - KPI-Karten (Teilnehmer, Key Points, Action Items, Woerter)
  - Sprechanteile als Pie-Chart (mit Recharts, gleich wie DeepDiveModal)
  - Business vs. Small Talk Pie-Chart
  - Zusammenfassung als formatierter Text-Block
  - Key Points als nummerierte Liste mit farbigen Markierungen
  - Action Items als Checkliste
  - Optional: Transkript-Auszug
- Nutzt die bestehende `performDeepDiveAnalysis()` Funktion fuer die Datenaufbereitung
- Styling: Print-optimierte CSS-Klassen, helle Farben fuer guten Druck

**2. Datei: `src/components/meeting/ReportDownloadModal.tsx` -- Erweitern**
- Neues Format "PDF (Visueller Bericht)" als Option neben TXT und Markdown
- Bei Auswahl von PDF:
  - Rendert `VisualReportView` unsichtbar im DOM
  - Nutzt `html2canvas` um das gerenderte HTML als Bild zu erfassen
  - Fuegt das Bild via `jsPDF` in ein PDF-Dokument ein
  - Laedt die PDF-Datei herunter
- Die bestehenden Content-Toggles (Zusammenfassung, Key Points, etc.) bleiben erhalten und steuern auch den visuellen Report

**3. Datei: `src/pages/MeetingDetail.tsx` -- Minimale Anpassung**
- Uebergibt zusaetzlich `transcript_text` und `user_email` an das `ReportDownloadModal`, damit die Deep-Dive-Analyse berechnet werden kann

### Visuelles Layout des Reports

```text
+--------------------------------------------------+
|  MEETING-BERICHT                                  |
|  "Stellantis Training & Projekt-Updates"          |
|  09. Februar 2026, 13:49 Uhr                     |
+--------------------------------------------------+
|                                                    |
|  [4 Teilnehmer]  [6 Key Points]  [3 To-Dos]      |
|  [1.234 Woerter] [23 Min]                         |
|                                                    |
+------------------------+--------------------------+
|  Sprechanteile         |  Business vs. Small Talk |
|  [Pie Chart]           |  [Pie Chart]             |
|  - Sprecher 1: 40%     |  Business: 85%           |
|  - Sprecher 2: 35%     |  Small Talk: 15%         |
|  - Sprecher 3: 25%     |                          |
+------------------------+--------------------------+
|                                                    |
|  ZUSAMMENFASSUNG                                   |
|  Lorem ipsum dolor sit amet...                     |
|                                                    |
|  KEY POINTS                                        |
|  1. Punkt eins                                     |
|  2. Punkt zwei                                     |
|                                                    |
|  ACTION ITEMS                                      |
|  [ ] Aufgabe eins                                  |
|  [ ] Aufgabe zwei                                  |
|                                                    |
+--------------------------------------------------+
|  Generiert am 13.02.2026                          |
+--------------------------------------------------+
```

### Technische Details

| Aspekt | Detail |
|--------|--------|
| Neue Pakete | `html2canvas`, `jspdf` |
| Neue Datei | `src/components/meeting/VisualReportView.tsx` |
| Geaenderte Dateien | `ReportDownloadModal.tsx`, `MeetingDetail.tsx` |
| Datenquelle | `performDeepDiveAnalysis()` aus `@/utils/deepDiveAnalysis` |
| Charts | Recharts PieChart (SVG-basiert, wird von html2canvas unterstuetzt) |
| PDF-Groesse | A4 Hochformat |
| Fallback | TXT/MD Export bleibt weiterhin verfuegbar |

