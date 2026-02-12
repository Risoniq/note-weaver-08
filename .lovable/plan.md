

## Team-Mitglieder zu Projekten einladen

### Ueberblick

Aktuell gehoert ein Projekt einem einzelnen User (`projects.user_id`). Es soll moeglich sein, Team-Mitglieder (aus dem gleichen Team) zu einem Projekt einzuladen. Der eingeladene User sieht das Projekt in seiner Projektliste und kann "Beitreten" klicken, um alle Meetings des Projekts einzusehen.

### Datenbank-Aenderungen

**Neue Tabelle `project_members`:**

| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| id | uuid | Primaerschluessel |
| project_id | uuid | Referenz auf das Projekt |
| user_id | uuid | Eingeladener User |
| invited_by | uuid | Wer hat eingeladen |
| status | text | "pending" oder "joined" |
| created_at | timestamptz | Zeitstempel |

UNIQUE-Constraint auf `(project_id, user_id)`.

**RLS-Policies auf `project_members`:**
- SELECT: User kann Eintraege sehen, wo er `user_id` oder `invited_by` ist, oder wo er Owner des Projekts ist
- INSERT: Nur der Projekt-Owner kann einladen (und nur Team-Mitglieder aus dem gleichen Team)
- UPDATE: Nur der eingeladene User kann seinen Status auf "joined" setzen
- DELETE: Projekt-Owner oder der eingeladene User koennen den Eintrag loeschen

**Neue RLS-Policy auf `projects`:**
- SELECT: User kann Projekte sehen, bei denen er in `project_members` mit Status "joined" eingetragen ist

**Neue RLS-Policy auf `project_recordings`:**
- SELECT: User kann project_recordings sehen, wenn er in `project_members` mit Status "joined" fuer dieses Projekt eingetragen ist

**Neue RLS-Policy auf `recordings`:**
- SELECT: User kann Recordings sehen, die ueber `project_recordings` einem Projekt zugeordnet sind, bei dem er Mitglied mit Status "joined" ist

### Edge Function: `project-invite`

Aktionen:
- **invite**: Projekt-Owner gibt eine E-Mail ein. Die Funktion prueft ob der Ziel-User im gleichen Team ist. Falls ja, wird ein Eintrag in `project_members` mit Status "pending" erstellt.
- **list**: Alle Mitglieder/Einladungen eines Projekts auflisten (mit E-Mails)
- **remove**: Ein Mitglied entfernen (nur Projekt-Owner)

### Frontend-Aenderungen

**1. Einladungs-Button auf der Projekt-Detailseite (`ProjectDetail.tsx`)**
- Neues "Einladen"-Icon neben "Meetings zuordnen"
- Oeffnet einen `InviteToProjectDialog`

**2. Neuer InviteToProjectDialog (`src/components/projects/InviteToProjectDialog.tsx`)**
- Eingabefeld fuer die E-Mail des Team-Mitglieds
- Liste der aktuellen Mitglieder mit Status (Eingeladen / Beigetreten) und Entfernen-Option
- Nur Team-Mitglieder koennen eingeladen werden

**3. Projekt-Liste erweitern (`Projects.tsx` und `useProjects.ts`)**
- Neben eigenen Projekten auch Projekte laden, zu denen der User eingeladen wurde (via `project_members`)
- Projekte mit Status "pending" zeigen einen "Beitreten"-Button
- Projekte mit Status "joined" verhalten sich wie eigene Projekte (ohne Loeschen/Bearbeiten)

**4. ProjectCard Anpassung (`ProjectCard.tsx`)**
- Badge "Einladung" bei Projekten mit Status "pending"
- "Beitreten"-Button statt Loeschen-Button bei eingeladenen Projekten
- Badge "Geteilt" bei beigetretenen Projekten
- Kein Loeschen-Button fuer nicht-eigene Projekte

**5. ProjectDetail Anpassung**
- Eingeladene User koennen Meetings sehen aber nicht entfernen oder zuordnen
- Nur der Owner sieht "Meetings zuordnen", "Einladen" und "KI-Analyse"

### Technische Details

```text
Ablauf: Projekt-Einladung
+------------------+     +---------------------+     +------------------+
| ProjectDetail    | --> | InviteToProject     | --> | project-invite   |
| (Einladen-Btn)   |     | Dialog (E-Mail)     |     | Edge Function    |
+------------------+     +---------------------+     +------------------+
                                                            |
                                                            v
                                                 +---------------------+
                                                 | project_members     |
                                                 | status: "pending"   |
                                                 +---------------------+

Ablauf: Beitreten
+------------------+     +---------------------+
| Projects-Liste   | --> | project_members     |
| (Beitreten-Btn)  |     | status: "joined"    |
+------------------+     +---------------------+
                                |
                                v
                         Zugriff auf Projekt
                         + alle zugeordneten
                         Recordings via RLS
```

### Zusammenfassung der Dateien

| Datei | Aenderung |
|-------|-----------|
| Migration SQL | Neue Tabelle `project_members` + RLS-Policies auf projects, project_recordings, recordings |
| `supabase/functions/project-invite/index.ts` | Neue Edge Function |
| `src/components/projects/InviteToProjectDialog.tsx` | Neuer Dialog |
| `src/pages/ProjectDetail.tsx` | Einladen-Button + Owner-Logik |
| `src/pages/Projects.tsx` | Eingeladene Projekte anzeigen |
| `src/hooks/useProjects.ts` | Eingeladene Projekte laden + Beitreten-Mutation |
| `src/components/projects/ProjectCard.tsx` | Einladungs-Badge + Beitreten-Button |

