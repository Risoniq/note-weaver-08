

# Fix: Infinite Recursion in project_recordings RLS

## Ursache

Die INSERT-Policy auf `project_recordings` enthaelt eine Subquery auf die `recordings`-Tabelle:

```text
EXISTS (SELECT 1 FROM recordings WHERE recordings.id = ... AND recordings.user_id = auth.uid())
```

Die `recordings`-Tabelle hat ihrerseits eine SELECT-Policy ("Project members can view project recordings"), die `project_recordings` abfragt. Damit entsteht ein Zirkelschluss:

```text
project_recordings INSERT
  -> prueft recordings (RLS feuert)
    -> recordings SELECT-Policy prueft project_recordings (RLS feuert)
      -> project_recordings SELECT prueft projects (RLS feuert)
        -> projects SELECT prueft project_members ... (aber ggf. erneut recordings)
          -> Endlosschleife
```

## Loesung

Zwei `SECURITY DEFINER`-Funktionen erstellen, die die Ownership-Pruefungen ohne RLS durchfuehren:

### 1. Neue Datenbankfunktionen (Migration)

```sql
-- Prueft ob ein User Owner eines Projekts ist
CREATE OR REPLACE FUNCTION public.is_project_owner(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = _project_id AND user_id = _user_id
  )
$$;

-- Prueft ob ein User Owner einer Aufnahme ist
CREATE OR REPLACE FUNCTION public.is_recording_owner(_user_id uuid, _recording_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.recordings
    WHERE id = _recording_id AND user_id = _user_id
  )
$$;

-- Prueft ob ein User Mitglied eines Projekts ist
CREATE OR REPLACE FUNCTION public.is_project_member(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = _project_id AND user_id = _user_id AND status = 'joined'
  )
$$;
```

### 2. project_recordings Policies ersetzen

Alle vier Policies auf `project_recordings` werden gedroppt und durch neue ersetzt, die die SECURITY DEFINER-Funktionen nutzen:

- **SELECT (own):** `is_project_owner(auth.uid(), project_id)`
- **SELECT (shared):** `is_project_member(auth.uid(), project_id)`
- **INSERT:** `is_project_owner(auth.uid(), project_id) AND is_recording_owner(auth.uid(), recording_id)`
- **DELETE:** `is_project_owner(auth.uid(), project_id)`

### 3. recordings Policy ersetzen

Die problematische SELECT-Policy "Project members can view project recordings" auf der `recordings`-Tabelle wird ebenfalls angepasst, um eine SECURITY DEFINER-Funktion zu nutzen statt direkt `project_recordings` abzufragen:

```sql
-- Neue Funktion: Prueft ob eine Aufnahme einem Projekt zugeordnet ist, bei dem der User Mitglied ist
CREATE OR REPLACE FUNCTION public.can_view_via_project(_user_id uuid, _recording_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_recordings pr
    JOIN public.project_members pm ON pm.project_id = pr.project_id
    WHERE pr.recording_id = _recording_id
      AND pm.user_id = _user_id
      AND pm.status = 'joined'
  )
$$;
```

Die Policy wird dann zu:
```sql
CREATE POLICY "Project members can view project recordings"
ON public.recordings FOR SELECT
USING (deleted_at IS NULL AND public.can_view_via_project(auth.uid(), id));
```

### Zusammenfassung der Aenderungen

- 4 neue SECURITY DEFINER-Funktionen erstellen
- 4 Policies auf `project_recordings` droppen und neu erstellen
- 1 Policy auf `recordings` droppen und neu erstellen
- Keine Code-Aenderungen noetig, nur Datenbank-Migration

