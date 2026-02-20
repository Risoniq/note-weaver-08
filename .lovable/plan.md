
# Dashboard-Karussell fuer dynamische Inhalte

## Ziel
Die drei GlassCards im Dashboard (Bot senden, Audio hochladen, Account-Analyse) werden in ein horizontales Karussell umgewandelt. Auf Desktop werden weiterhin alle 3 Karten sichtbar sein, auf kleineren Bildschirmen kann der Nutzer durch die Karten wischen/navigieren. Das Karussell nutzt die bereits installierte `embla-carousel-react` Bibliothek und die vorhandene `carousel.tsx` UI-Komponente.

## Aenderungen

### Datei: `src/pages/Index.tsx`

1. **Imports hinzufuegen**: `Carousel`, `CarouselContent`, `CarouselItem`, `CarouselPrevious`, `CarouselNext` aus `@/components/ui/carousel` importieren.

2. **Grid durch Karussell ersetzen**: Der bisherige `grid grid-cols-1 lg:grid-cols-3` Block (Zeilen 86-119) wird durch eine Karussell-Struktur ersetzt:

```
Vorher:
<div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
  <GlassCard>...</GlassCard>
  <GlassCard>...</GlassCard>
  <GlassCard>...</GlassCard>
</div>

Nachher:
<Carousel opts={{ align: "start", loop: true }} className="w-full">
  <CarouselContent className="-ml-4">
    <CarouselItem className="pl-4 md:basis-1/2 lg:basis-1/3">
      <GlassCard>Bot zu Meeting senden</GlassCard>
    </CarouselItem>
    <CarouselItem className="pl-4 md:basis-1/2 lg:basis-1/3">
      <GlassCard>Audio/Video hochladen</GlassCard>
    </CarouselItem>
    <CarouselItem className="pl-4 md:basis-1/2 lg:basis-1/3">
      <GlassCard>Account/Team-Analyse</GlassCard>
    </CarouselItem>
    <!-- Platz fuer weitere Karten in Zukunft -->
  </CarouselContent>
  <CarouselPrevious />
  <CarouselNext />
</Carousel>
```

3. **Responsive Verhalten**:
   - Mobil (< 768px): 1 Karte sichtbar, wischbar
   - Tablet (768px+): 2 Karten sichtbar
   - Desktop (1024px+): 3 Karten sichtbar (alle auf einmal)
   - `loop: true` ermoeglicht endloses Durchblaettern

4. **Erweiterbarkeit**: Durch die Karussell-Struktur koennen spaeter einfach weitere `CarouselItem`-Karten hinzugefuegt werden (z.B. Kalender-Schnellzugriff, letzte Aufnahmen, Tipps), die dann per Wischen/Pfeile erreichbar sind.

## Betroffene Dateien

| Datei | Aenderung |
|-------|-----------|
| `src/pages/Index.tsx` | Grid durch Carousel-Komponente ersetzen, Imports ergaenzen |

## Ergebnis
- Dynamisches, wischbares Karussell im Dashboard
- Auf Desktop bleiben alle 3 Karten sichtbar (kein Unterschied zum jetzigen Layout)
- Auf Mobil/Tablet wird gewischt oder per Pfeiltasten navigiert
- Einfach erweiterbar um zusaetzliche Dashboard-Karten
