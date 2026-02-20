

# Karussell 3D-Effekt und Pfeil-Abstand verbessern

## Problem
1. Die Pfeile (`-left-12` / `-right-12`) sitzen zu nah am Rand und werden teilweise abgeschnitten
2. Die Karten stehen flach nebeneinander -- kein "Karussell-Gefuehl"

## Loesung

### 1. Mehr Platz fuer die Pfeile (Index.tsx)
Das Karussell bekommt `px-14` Padding, damit die absolut positionierten Pfeile genug Platz haben und nicht am Rand kleben.

### 2. 3D-Perspektive und Tiefeneffekt (Index.tsx)
Eine eigene Karussell-Komponente mit CSS `perspective` und `transform: rotateY()` wird erstellt, die nicht-aktive Karten leicht nach hinten dreht und verkleinert. Dadurch entsteht ein dreidimensionaler Stapel-Effekt:

- **Aktive Karte**: volle Groesse, `scale(1)`, `rotateY(0)`, volle Deckkraft
- **Benachbarte Karten**: leicht gedreht (`rotateY(-8deg)` bzw. `rotateY(8deg)`), verkleinert (`scale(0.92)`), leicht transparent (`opacity: 0.7`)

### Technischer Ansatz
Da Embla Carousel die Slides flach als Flex-Items rendert, wird der 3D-Effekt ueber CSS `perspective` auf dem Container und dynamische `transform`-Styles auf den Items erreicht. Dafuer wird ein `setApi`-Callback genutzt, der bei `select`-Events den aktiven Index trackt und per State die Styles auf die Items anwendet.

## Aenderungen

### Datei: `src/pages/Index.tsx`

1. **Padding um Karussell**: `className="w-full px-14"` statt `className="w-full"` -- gibt den Pfeilen links/rechts je 56px Platz

2. **3D-Karussell-Wrapper**: Ein neuer State `activeIndex` wird per `setApi` + `select`-Event getrackt. Die `CarouselContent` bekommt `style={{ perspective: '1200px' }}`. Jedes `CarouselItem` bekommt dynamische Inline-Styles basierend auf seiner Position relativ zum aktiven Index:

```text
Karte links:   transform: rotateY(8deg) scale(0.92)   opacity: 0.7
Karte mitte:   transform: rotateY(0) scale(1)          opacity: 1
Karte rechts:  transform: rotateY(-8deg) scale(0.92)   opacity: 0.7
```

3. **Transitions**: `transition: all 0.5s ease` auf den Items fuer fluessige Uebergaenge beim Scrollen.

### Datei: `src/components/ui/carousel.tsx`

Keine Aenderungen noetig -- die 3D-Logik wird komplett in Index.tsx ueber Inline-Styles und State gehandhabt.

## Ergebnis
- Pfeile haben deutlich mehr Abstand zum Seitenrand
- Karten wirken gestapelt/dreidimensional mit Tiefeneffekt
- Beim Scrollen drehen sich die Karten fluessig in die Mitte
- Der Karussell-Charakter wird visuell viel staerker spuerbar
