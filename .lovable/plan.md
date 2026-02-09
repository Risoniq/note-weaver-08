

## Intelligence Fusion Dashboard (IFD) - Projekte und Meeting-Zuordnung

### Uebersicht

Ein neues Projekt-System, mit dem Meetings einzelnen Projekten zugeordnet werden koennen. Darauf aufbauend ein "Intelligence Fusion Dashboard" (IFD), das den Fortschritt ueber mehrere Meetings hinweg mit Grafiken visualisiert.

### Neue Datenbank-Tabellen

| Tabelle | Zweck |
|---|---|
| `projects` | Projekte eines Users (Name, Beschreibung, Status, Farbe) |
| `project_recordings` | Zuordnung von Recordings zu Projekten (n:m) |

**projects:**
- `id` (uuid, PK)
- `user_id` (uuid, NOT NULL)
- `name` (text, NOT NULL)
- `description` (text, nullable)
- `color` (text, default '#6366f1')
- `status` (text, default 'active') -- active, completed, archived
- `created_at`, `updated_at` (timestamps)

**project_recordings:**
- `id` (uuid, PK)
- `project_id` (uuid, FK -> projects)
- `recording_id` (uuid, FK -> recordings)
- `added_at` (timestamp)
- UNIQUE(project_id, recording_id)

RLS-Policies: User sieht/bearbeitet nur eigene Projekte. Zuordnungen nur fuer eigene Projekte und eigene Recordings.

### Neue Seite: `/projects`

Eine eigene Seite fuer Projekte mit zwei Ansichten:

1. **Projektliste** - Alle Projekte als Karten mit Name, Beschreibung, Anzahl zugeordneter Meetings, Status-Badge
2. **Projekt-Detail / IFD** - Wird per Klick auf ein Projekt geoeffnet

### Navigation

Neuer Eintrag "Projekte" in der Sidebar (`AppSidebar.tsx`) zwischen "Dashboard" und "Aufnahmen", mit dem `FolderKanban`-Icon.

### Projekt erstellen und verwalten

- Dialog zum Erstellen neuer Projekte (Name, Beschreibung, Farbe)
- Meetings zuordnen: Dropdown/Suche ueber abgeschlossene Recordings
- Meetings entfernen aus Projekten

### Intelligence Fusion Dashboard (IFD)

Wenn ein Projekt geoeffnet wird, erscheint das IFD mit folgenden Visualisierungen:

| Grafik | Beschreibung |
|---|---|
| **Fortschritts-Timeline** | LineChart - Action Items / Key Points pro Meeting ueber Zeit |
| **Kumulative To-Dos** | AreaChart - Wie viele To-Dos ueber alle Meetings kumuliert entstehen |
| **Sprechanteile-Trend** | StackedBarChart - Wie sich Sprechanteile ueber Meetings veraendern |
| **Themen-Heatmap** | Haeufigste Begriffe/Themen ueber alle Meeting-Transkripte |
| **Projekt-KPIs** | Gesamtdauer, Anzahl Meetings, Gesamte Action Items, Gesamte Key Points |

Alle Grafiken verwenden `recharts` (bereits installiert).

### Edge Function: `analyze-project`

Eine neue Edge Function, die fuer ein Projekt eine KI-gestuetzte Gesamtanalyse ueber alle zugehoerigen Meetings generiert:
- Projekt-Zusammenfassung (ueber alle Meetings)
- Fortschritts-Bewertung
- Offene vs. erledigte Themen
- Empfehlungen fuer naechste Schritte

Das Ergebnis wird in `projects.analysis` (JSON-Feld) gespeichert.

### Neue Dateien

| Datei | Zweck |
|---|---|
| `src/pages/Projects.tsx` | Projektliste-Seite |
| `src/pages/ProjectDetail.tsx` | IFD fuer ein einzelnes Projekt |
| `src/components/projects/ProjectCard.tsx` | Karte fuer Projektliste |
| `src/components/projects/CreateProjectDialog.tsx` | Dialog zum Erstellen |
| `src/components/projects/AssignRecordingsDialog.tsx` | Meetings zuordnen |
| `src/components/projects/IFDTimeline.tsx` | Timeline-Chart |
| `src/components/projects/IFDKpiCards.tsx` | KPI-Uebersicht |
| `src/components/projects/IFDSpeakerTrend.tsx` | Sprechanteile-Trend |
| `src/components/projects/IFDTopicCloud.tsx` | Themen-Heatmap |
| `src/hooks/useProjects.ts` | Hook fuer CRUD-Operationen |
| `src/hooks/useProjectAnalysis.ts` | Hook fuer KI-Analyse |
| `supabase/functions/analyze-project/index.ts` | KI-Gesamtanalyse |

### Geaenderte Dateien

| Datei | Aenderung |
|---|---|
| `src/components/layout/AppSidebar.tsx` | Neuer Menuepunkt "Projekte" |
| `src/App.tsx` | Neue Routen `/projects` und `/projects/:id` |
| `src/pages/MeetingDetail.tsx` | Optional: Button "Zu Projekt hinzufuegen" |

### Umsetzungsreihenfolge

1. Datenbank-Migration (Tabellen + RLS)
2. Sidebar + Routing
3. Projektliste + Erstellen-Dialog
4. Meeting-Zuordnung
5. IFD-Visualisierungen (Charts)
6. Edge Function fuer KI-Analyse
7. KI-Analyse in Projekt-Detail einbinden

