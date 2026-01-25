
# "Bot zu Meeting senden" lebendiger gestalten

## Übersicht
Der zentrale Call-to-Action-Bereich wird visuell hervorgehoben, um den Fokus direkt darauf zu lenken - minimalistisch und modern mit subtilen Animationen und einem dezenten Gradient-Akzent.

## Design-Konzept

**Visueller Fokus durch:**
- Subtiler animierter Gradient-Rand (Primary-Farbe)
- Leichte Pulse-Animation auf dem Bot-Icon
- Größeres, prominenteres Input-Feld
- Entfernung der doppelten Card-Verschachtelung
- Hover-State mit sanftem Glow-Effekt

## Änderungen

### 1. QuickMeetingJoin.tsx - Redesign

**Visuelle Verbesserungen:**
- Entfernung des inneren `bg-card border` Containers (redundant mit GlassCard)
- Größeres Bot-Icon mit subtiler Pulse-Animation
- Prominentere Überschrift
- Input und Button in einer visuell ansprechenderen Anordnung
- Dezenter Gradient-Akzent am oberen Rand

```text
┌────────────────────────────────────────────────────┐
│  ════════════ (Primary Gradient Line) ════════════ │
│                                                     │
│        🤖  Bot zu Meeting senden                   │
│        (pulsierendes Icon)                         │
│                                                     │
│   ┌─────────────────────────────────┐  ┌────────┐  │
│   │ Meeting-URL eingeben...         │  │ Senden │  │
│   └─────────────────────────────────┘  └────────┘  │
│                                                     │
│   Unterstützt: Google Meet • Teams • Zoom • Webex  │
└────────────────────────────────────────────────────┘
```

### 2. index.css - Neue Animationen

**Hinzufügen:**
- `@keyframes subtle-pulse` - Sanftes Pulsieren für das Icon
- `@keyframes gradient-shift` - Animierter Gradient für den Akzent
- `.focus-glow` - Hover-Glow-Effekt

### 3. GlassCard - Optionale Highlight-Variante

**Neue Prop `highlight`:**
- Aktiviert einen dezenten Gradient-Akzent am oberen Rand
- Leicht verstärkter Shadow bei Hover

## Technische Details

### QuickMeetingJoin.tsx Änderungen

```typescript
// Vorher: Doppelte Card-Struktur
<div className="bg-card border border-border rounded-xl p-4">

// Nachher: Fokus auf Inhalt, transparenter Hintergrund
<div className="space-y-4">
  {/* Gradient Akzent-Linie */}
  <div className="h-1 bg-gradient-to-r from-primary/60 via-primary to-primary/60 rounded-full" />
  
  {/* Icon mit Animation */}
  <div className="flex items-center gap-3">
    <div className="p-3 rounded-2xl bg-primary/10 animate-subtle-pulse">
      <Bot size={24} className="text-primary" />
    </div>
    <div>
      <h3 className="text-lg font-semibold">Bot zu Meeting senden</h3>
      <p className="text-sm text-muted-foreground">Sofort aufnehmen lassen</p>
    </div>
  </div>
```

### Neue CSS-Animationen

```css
@keyframes subtle-pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.85;
  }
}

.animate-subtle-pulse {
  animation: subtle-pulse 3s ease-in-out infinite;
}
```

## Dateien die geändert werden

| Datei | Änderung |
|-------|----------|
| `src/components/calendar/QuickMeetingJoin.tsx` | Redesign mit Fokus-Elementen, größeres Icon, Gradient-Akzent |
| `src/index.css` | Neue `subtle-pulse` Animation hinzufügen |

## Ergebnis

- **Minimalistisch**: Keine überladenen Elemente, klare Hierarchie
- **Modern**: Glasmorphism + dezente Animationen + Gradient-Akzente
- **Fokussiert**: Der Blick wird automatisch auf den CTA-Bereich gelenkt
- **Subtil lebendig**: Sanftes Pulsieren signalisiert Aktivität ohne zu stören
