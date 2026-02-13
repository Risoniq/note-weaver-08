

## Metriken minimalistischer und futuristischer gestalten

### Ziel
Die Statistik-Karten und Metriken in der Account-Analyse (Card + Modal) erhalten ein minimalistisches, futuristisches Design mit Monospace-Zahlen, subtilen Glow-Effekten und reduzierter visueller Dichte.

### Aenderungen

**1. `src/components/dashboard/AccountAnalyticsModal.tsx` -- StatCard futuristisch**
- StatCard-Komponente ueberarbeiten:
  - Monospace-Font fuer Zahlenwerte (`font-mono tracking-wider`)
  - Groessere, duennere Zahlen (`text-2xl font-light` statt `text-xl font-semibold`)
  - Subtiler Glow-Effekt auf dem Wert (`text-primary drop-shadow-[0_0_6px_rgba(var(--primary-rgb),0.3)]`)
  - Icon entfernen oder stark verkleinern (nur als dezenter Akzent)
  - Labels in Uppercase-Tracking (`uppercase tracking-[0.15em] text-[10px]`)
  - Hintergrund: transparent mit feiner Borderlinie statt `bg-muted/30`
- Pie-Chart-Sektionen: Labels in Monospace, Prozente mit Glow
- Effektivitaets-Metriken: Prozentwerte in Monospace mit leichtem Farbakzent

**2. `src/components/dashboard/AccountAnalyticsCard.tsx` -- Mini-Stats futuristisch**
- Stats Grid: Zahlen in `font-mono font-light text-lg` statt `font-medium`
- Labels in `uppercase tracking-widest text-[10px]`
- Icons noch kleiner oder durch minimale Linien-Akzente ersetzen

**3. `src/components/projects/IFDKpiCards.tsx` -- Projekt-KPIs angleichen**
- Gleicher futuristischer Stil: Monospace-Zahlen, Uppercase-Labels, reduzierte Icon-Groesse

### Visuelles Konzept

```
Aktuell:                          Neu (futuristisch):
+------------------+              +------------------+
|    [Icon]        |              |                  |
|    42            |              |      42          |
|   Meetings       |              |   MEETINGS       |
+------------------+              +------------------+
  (bg-muted, bold)                 (transparent, mono,
                                    thin, glow, uppercase)
```

### Betroffene Dateien

| Datei | Aenderung |
|-------|-----------|
| `src/components/dashboard/AccountAnalyticsModal.tsx` | StatCard futuristisch, Pie-Chart Labels minimalistisch |
| `src/components/dashboard/AccountAnalyticsCard.tsx` | Stats Grid futuristisch |
| `src/components/projects/IFDKpiCards.tsx` | KPI-Karten im gleichen Stil |

