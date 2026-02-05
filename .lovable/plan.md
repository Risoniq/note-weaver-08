

## Aufnahmen als eigenständiger Navigationsreiter

### Übersicht
Die "Aufnahmen"-Übersicht wird aus dem Dashboard herausgelöst und erhält eine eigene Route `/recordings` mit einem dedizierten Navigationseintrag neben "Transkripte".

---

## Änderungen

### 1. Neue Seite erstellen
**Datei:** `src/pages/Recordings.tsx` (neu)

Eine neue Seite, die die RecordingsList mit dem Team-Toggle anzeigt:
- Header mit Titel "Aufnahmen"
- Team/Personal Toggle für Teamleads
- Die bestehende RecordingsList-Komponente

### 2. Navigation erweitern
**Datei:** `src/components/layout/AppLayout.tsx`

Neuen Navigationseintrag hinzufügen:
```typescript
const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Kalender", url: "/calendar", icon: Calendar },
  { title: "Aufnahmen", url: "/recordings", icon: Video },  // NEU
  { title: "Transkripte", url: "/transcripts", icon: FileText },
  { title: "Einstellungen", url: "/settings", icon: Settings },
];
```

### 3. Route registrieren
**Datei:** `src/App.tsx`

Neue Route hinzufügen:
```typescript
import Recordings from "./pages/Recordings";
// ...
<Route path="/recordings" element={<ProtectedRoute><Recordings /></ProtectedRoute>} />
```

### 4. Dashboard vereinfachen
**Datei:** `src/pages/Index.tsx`

Die RecordingsList vom Dashboard entfernen, da sie nun eine eigene Seite hat. Der Team-Toggle wird ebenfalls zur Recordings-Seite verschoben.

---

## Technische Details

| Komponente | Änderung |
|------------|----------|
| `src/pages/Recordings.tsx` | Neue Seite mit RecordingsList + Team-Toggle |
| `AppLayout.tsx` | + "Aufnahmen" Navigationseintrag mit Video-Icon |
| `App.tsx` | + Route `/recordings` |
| `Index.tsx` | − RecordingsList entfernen, − Team-Toggle entfernen |

## Visuelles Ergebnis
```text
[Dashboard] [Kalender] [Aufnahmen] [Transkripte] [Einstellungen]
                          ↑
                      Neuer Tab
```

Die Aufnahmen-Seite zeigt alle Recordings in einer Kartenansicht mit Teamlead-Funktionalität (Team/Personal-Umschaltung).

