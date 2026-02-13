

## Risoniq-Branding und Dashboard-Farben fuer den PDF-Bericht

### Ziel
Der PDF-Bericht (VisualReportView) erhaelt das Risoniq-Branding und wird farblich an die dunkle, futuristische Dashboard-Aesthetik angepasst. Orientierung: dunkler Hintergrund, Cyan/Teal-Akzente, Monospace-Zahlen, Glow-Effekte -- analog zu den Referenzbildern.

### Aenderungen

**1. Risoniq-Logo als Asset einbinden**
- Das Bild `Risoniq_Meeting_Hintergrund.jpg` wird in `src/assets/` kopiert
- Daraus wird das Risoniq-Logo als SVG/Text-Element im Bericht-Header nachgebaut (orange/gold Wellenlinien + "RISONIQ"-Schriftzug), da ein Foto als Logo-Quelle im PDF unscharf wuerde
- Alternative: Nur den Markennamen "RISONIQ" als gestylten Text mit passender Farbe (#e87722 Orange-Gold) einsetzen

**2. `src/components/meeting/VisualReportView.tsx` -- Komplettes Redesign**

| Bereich | Aktuell | Neu |
|---------|---------|-----|
| Hintergrund | Weiss (#ffffff) | Dunkel (#0f1724) |
| Textfarbe | Dunkel (#1a1a2e) | Hell (#e2e8f0) |
| Header | Blauer Border, schwarzer Titel | Risoniq-Logo links, Titel rechts, Cyan-Akzentlinie |
| KPI-Karten | Helle Cards, fetter schwarzer Text | Transparenter Hintergrund, duenne Cyan-Border, Monospace-Font, Glow-Effekt auf Zahlen |
| Chart-Container | Heller Border | Dunkler Hintergrund (#1a2332), feine Border (#2d3748) |
| Sektions-Ueberschriften | Schwarzer Text mit grauer Linie | Cyan (#0ea5e9) mit Glow, Uppercase-Tracking |
| Action Items | Graue Checkboxen | Cyan-Checkboxen |
| Footer | Grauer zentrierter Text | "Powered by RISONIQ" mit Logo-Farbe, Generierungsdatum |

Farbpalette fuer den Bericht:
- Hintergrund: `#0f1724` (Dashboard dark bg)
- Sekundaer-BG: `#1a2332`
- Primary/Akzent: `#0ea5e9` (Cyan/Teal -- Dashboard Primary)
- Accent: `#e87722` (Risoniq Orange fuer Logo/Branding)
- Text: `#e2e8f0` (hell)
- Muted Text: `#94a3b8`
- Borders: `#2d3748`

KPI-Karten Stil:
```
Wert: font-family monospace, font-weight 300, color #0ea5e9, text-shadow 0 0 8px rgba(14,165,233,0.4)
Label: uppercase, letter-spacing 0.15em, font-size 10px, color #94a3b8
```

Header-Layout:
```
[RISONIQ]                     Meeting-Bericht
 (orange)          Titel des Meetings (22px, hell)
                   Datum (13px, muted)
─────────────────────────────────────────── (cyan line)
```

Footer:
```
──────────────────────────────────────────
Powered by RISONIQ  |  Generiert am 13.02.2026 14:30 Uhr
```

**3. html2canvas Anpassung in `ReportDownloadModal.tsx`**
- `backgroundColor` von `#ffffff` auf `#0f1724` aendern, damit der dunkle Hintergrund korrekt gerendert wird

### Betroffene Dateien

| Datei | Aenderung |
|-------|-----------|
| `src/components/meeting/VisualReportView.tsx` | Komplettes Redesign: dunkles Theme, Risoniq-Branding, futuristische KPIs |
| `src/components/meeting/ReportDownloadModal.tsx` | backgroundColor auf dunkel aendern |

