
# Sanfte Animation beim Theme-Wechsel

## Übersicht
Eine CSS-Transition wird hinzugefügt, die alle Farbänderungen beim Theme-Wechsel sanft animiert - Hintergründe, Textfarben, Rahmen und Schatten werden über 300ms weich übergeblendet.

## Änderungen

### 1. Globale Theme-Transition in CSS hinzufügen

**Datei: `src/index.css`**

Im `@layer base` Abschnitt wird eine Transition für den `body` und alle Elemente hinzugefügt:

```css
body {
  transition: background-color 0.3s ease, color 0.3s ease;
}

*, *::before, *::after {
  transition: background-color 0.3s ease, 
              border-color 0.3s ease, 
              box-shadow 0.3s ease;
}
```

### 2. Spezielle Transition-Klasse für Theme-Wechsel

Eine dedizierte Utility-Klasse wird erstellt:

```css
.theme-transition {
  transition: background-color 0.3s ease,
              color 0.3s ease,
              border-color 0.3s ease,
              box-shadow 0.3s ease,
              opacity 0.3s ease;
}
```

## Ergebnis

- Alle Farben (Hintergrund, Text, Rahmen, Schatten) werden sanft übergeblendet
- Der Wechsel von Hell zu Dunkel und umgekehrt fühlt sich flüssig an
- Die Animation dauert 300ms mit einer ease-Kurve für natürliches Gefühl
- Keine Auswirkung auf andere Animationen oder Performance

## Technische Details

Die Transition wird auf globaler Ebene in `src/index.css` definiert, sodass alle Elemente automatisch von der sanften Animation profitieren. Die `transition-property` ist auf spezifische Eigenschaften beschränkt (nicht `all`), um Performance-Probleme zu vermeiden.
