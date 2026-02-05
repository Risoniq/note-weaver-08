

## Animierter Link zu den Meeting-Analysen

### Übersicht
Ein animierter Call-to-Action unterhalb der drei Kacheln, der Nutzer zum neuen "Aufnahmen"-Tab führt.

---

## Änderungen

### 1. Animierten Link hinzufügen
**Datei:** `src/pages/Index.tsx`

Nach dem Grid mit den drei Kacheln (Zeile 93) einen zentrierten Link einfügen:

```tsx
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

// Nach dem Grid:
<Link 
  to="/recordings" 
  className="group flex items-center justify-center gap-2 py-4 text-lg font-medium text-primary transition-all duration-300 hover:gap-4"
>
  <span className="animate-fade-in">Zu den Meeting-Analysen</span>
  <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-2" />
</Link>
```

---

## Technische Details

| Element | Effekt |
|---------|--------|
| Text | Fade-in Animation beim Laden |
| Container | Gap vergrößert sich bei Hover (2 → 4) |
| Pfeil | Bewegt sich nach rechts bei Hover (`translate-x-2`) |
| Übergang | Sanfte 300ms Transition |

## Visuelles Ergebnis
```text
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  Bot senden │  │   Upload    │  │   Analyse   │
└─────────────┘  └─────────────┘  └─────────────┘

          Zu den Meeting-Analysen  →
                    ↑
           Hover: Pfeil bewegt sich

```

Der Link erscheint zentriert unter den Kacheln mit einer subtilen Animation und führt direkt zur Aufnahmen-Seite.

