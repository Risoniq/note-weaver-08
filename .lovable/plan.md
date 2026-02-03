
# Plan: Onboarding-Tour Klick-Bug beheben

## Problem

Beim Klicken auf den "Weiter"-Button in der Onboarding-Tour passiert nichts. Das Problem liegt in der CSS-Struktur der Komponente:

1. Das Backdrop-Element mit `pointer-events-auto` blockiert alle Maus-Events
2. Das Tooltip-Div liegt zwar visuell darüber (z-10), aber beide sind im gleichen Stacking-Kontext
3. Das SVG-Element für das Spotlight-Mask hat ebenfalls keine explizite z-index-Trennung

## Analyse der Struktur

```text
┌─ fixed inset-0 z-[9999] ─────────────────────────────────────┐
│                                                               │
│  ┌─ Backdrop (pointer-events-auto) ─────────────────────────┐│
│  │  SVG mit Spotlight-Maske (keine pointer-events)          ││
│  │  Spotlight-Glow (pointer-events-none)                    ││
│  └──────────────────────────────────────────────────────────┘│
│                                                               │
│  ┌─ Tooltip (z-10, keine pointer-events Definition) ────────┐│
│  │  GlassCard mit Buttons                                   ││
│  └──────────────────────────────────────────────────────────┘│
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

Das Problem: Das Backdrop hat `pointer-events-auto` und bedeckt die gesamte Fläche. Das Tooltip hat zwar `z-10`, aber **keinen expliziten `pointer-events-auto`**, während das Backdrop-Element die Events abfängt.

## Lösung

Das Tooltip-Container-Div benötigt `pointer-events-auto`, damit Klicks auf die Buttons funktionieren:

### Datei: `src/components/onboarding/OnboardingTour.tsx`

**Zeile 192-198** - Tooltip-Container anpassen:

Aktuell:
```tsx
<div
  ref={tooltipRef}
  className="absolute z-10 w-[360px] max-w-[calc(100vw-40px)] transition-all duration-300 ease-out"
  style={{...}}
>
```

Änderung:
```tsx
<div
  ref={tooltipRef}
  className="absolute z-10 w-[360px] max-w-[calc(100vw-40px)] transition-all duration-300 ease-out pointer-events-auto"
  style={{...}}
>
```

## Betroffene Datei

| Datei | Aktion |
|-------|--------|
| `src/components/onboarding/OnboardingTour.tsx` | `pointer-events-auto` zum Tooltip-Container hinzufügen |

## Technische Details

Die CSS-Eigenschaft `pointer-events` steuert, ob ein Element Maus-Events empfangen kann:
- `pointer-events-auto`: Element empfängt Maus-Events (Standard für die meisten Elemente, aber nicht in Overlay-Situationen)
- `pointer-events-none`: Element ignoriert Maus-Events (Events gehen an das Element darunter)

In einem Overlay wie diesem mit `position: fixed` und überlappenden Elementen muss das interaktive Element explizit `pointer-events-auto` haben, um sicherzustellen, dass es Klicks erhält.

## Ergebnis

- Klicks auf "Weiter", "Zurück", "Überspringen" und "X" funktionieren wieder
- Das Backdrop blockiert weiterhin Klicks auf die Seite dahinter
- Der Spotlight-Bereich bleibt weiterhin klickbar (falls gewünscht)
