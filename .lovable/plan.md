

## Problem

Der "Projekte"-Link wurde zur `AppSidebar` hinzugefuegt, aber die App verwendet gar nicht die Sidebar -- sie nutzt das `AppLayout` mit einer **Header-Navigation**. Deshalb ist der Projekte-Eintrag nirgends sichtbar.

### Loesung

In `src/components/layout/AppLayout.tsx` wird "Projekte" als neuer Navigationseintrag hinzugefuegt.

| Datei | Aenderung |
|---|---|
| `src/components/layout/AppLayout.tsx` | Neuen Nav-Eintrag "Projekte" mit `FolderKanban`-Icon zwischen "Aufnahmen" und "Einstellungen" einfuegen |

### Technische Details

- In der `navItems`-Liste (Zeile 15) wird ein neuer Eintrag `{ title: "Projekte", url: "/projects", icon: FolderKanban }` hinzugefuegt
- Das `FolderKanban`-Icon wird aus `lucide-react` importiert
- Der bestehende "Transkripte"-Eintrag kann entfernt werden, da `/transcripts` bereits auf `/recordings` weiterleitet
