

# Plan: Team-Funktionalität mit gemeinsamem Meeting-Kontingent

## Übersicht

Implementierung einer Team-Verwaltung, bei der mehrere Benutzer ein gemeinsames Meeting-Kontingent teilen können. Admins können Teams erstellen, Mitglieder zuweisen und das Team-Kontingent verwalten.

## Funktionsumfang

| Feature | Beschreibung |
|---------|-------------|
| Teams erstellen | Admin kann Teams mit Namen und Kontingent anlegen |
| Mitglieder zuweisen | Benutzer können einem Team zugeordnet werden |
| Gemeinsames Kontingent | Alle Team-Mitglieder teilen sich das Team-Kontingent |
| Hierarchie | Team-Kontingent hat Priorität vor individuellem Kontingent |
| Admin-Übersicht | Neue Team-Sektion im Admin-Dashboard |

## Datenbank-Schema

### Neue Tabellen

```text
┌─────────────────────────────────────────────────────────────┐
│                         teams                                │
├─────────────────────────────────────────────────────────────┤
│ id              │ uuid (PK)                                 │
│ name            │ text (NOT NULL)                           │
│ max_minutes     │ integer (DEFAULT 600 = 10h)               │
│ created_at      │ timestamptz                               │
│ updated_at      │ timestamptz                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     team_members                             │
├─────────────────────────────────────────────────────────────┤
│ id              │ uuid (PK)                                 │
│ team_id         │ uuid (FK -> teams)                        │
│ user_id         │ uuid (NOT NULL)                           │
│ role            │ text (DEFAULT 'member')                   │
│ created_at      │ timestamptz                               │
└─────────────────────────────────────────────────────────────┘
```

### RLS Policies

- Admins können alle Teams und Mitgliedschaften lesen/bearbeiten
- Team-Mitglieder können ihr eigenes Team lesen (für Quota-Anzeige)

## Backend-Änderungen

### Neue Edge Functions

| Function | Zweck |
|----------|-------|
| `admin-create-team` | Team erstellen mit Name und Kontingent |
| `admin-update-team` | Team-Details und Kontingent bearbeiten |
| `admin-delete-team` | Team löschen (Mitglieder werden zu Einzelnutzern) |
| `admin-assign-team-member` | User zu Team hinzufügen/entfernen |

### Anpassungen bestehender Functions

**`admin-dashboard/index.ts`**:
- Teams-Liste mit Statistiken hinzufügen
- Pro Team: Name, Mitgliederzahl, verbrauchtes/max Kontingent
- Pro User: Team-Zugehörigkeit anzeigen

**`create-bot/index.ts`**:
- Quota-Check erweitern: Prüfen ob User in einem Team ist
- Falls ja: Team-Kontingent verwenden statt individuelles

**`admin-set-quota`**:
- Erweitern für Team-Kontingent-Updates

### Quota-Logik (Priorität)

```text
1. Prüfe: Ist User Mitglied eines Teams?
   ├─ JA  → Verwende Team-Kontingent (Summe aller Team-Recordings)
   └─ NEIN → Verwende individuelles Kontingent (wie bisher)
```

## Frontend-Änderungen

### Admin.tsx - Neue Team-Sektion

```text
┌────────────────────────────────────────────────────────────┐
│  [Benutzer]  [Teams]                          + Team       │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Marketing-Team                    3 Mitglieder       │ │
│  │ ████████████░░░░░░  45h / 100h                      │ │
│  │ [Bearbeiten] [Mitglieder] [Löschen]                 │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Vertrieb                          5 Mitglieder       │ │
│  │ ██████████████████  90h / 100h                      │ │
│  │ [Bearbeiten] [Mitglieder] [Löschen]                 │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Benutzer-Tabelle Erweiterung

- Neue Spalte "Team" in der Benutzertabelle
- Dropdown-Auswahl um User zu Team hinzuzufügen
- Team-Mitglieder zeigen Team-Kontingent statt individuelles

### useUserQuota Hook Anpassung

- Prüfen ob User in Team ist
- Falls ja: Team-Quota laden und berechnen

## Implementierungs-Reihenfolge

### Phase 1: Datenbank
1. Migration: `teams` Tabelle erstellen
2. Migration: `team_members` Tabelle erstellen
3. RLS Policies für beide Tabellen

### Phase 2: Backend
4. `admin-create-team` Edge Function
5. `admin-update-team` Edge Function  
6. `admin-delete-team` Edge Function
7. `admin-assign-team-member` Edge Function
8. `admin-dashboard` erweitern (Teams-Daten laden)
9. `create-bot` Quota-Check für Teams erweitern

### Phase 3: Frontend
10. Admin.tsx: Tabs für Benutzer/Teams
11. Team-Erstellung Dialog
12. Team-Bearbeitung Dialog
13. Team-Mitglieder Dialog
14. Benutzer-Tabelle: Team-Zuordnung Dropdown
15. useUserQuota Hook: Team-Support

### Phase 4: User-Facing
16. QuotaProgressBar: Team-Kontingent anzeigen
17. Settings: Team-Info (read-only) anzeigen

## Technische Details

### SQL Migration

```sql
-- Teams Tabelle
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  max_minutes integer NOT NULL DEFAULT 600,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Team Mitglieder
CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- RLS aktivieren
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Admin Policies
CREATE POLICY "Admins can manage teams"
ON public.teams FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage team members"
ON public.team_members FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- User kann eigene Team-Zugehörigkeit lesen
CREATE POLICY "Users can view own team membership"
ON public.team_members FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- User kann eigenes Team lesen (über membership)
CREATE POLICY "Team members can view their team"
ON public.teams FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.team_members 
    WHERE team_members.team_id = teams.id 
    AND team_members.user_id = auth.uid()
  )
);
```

### Team-Quota Berechnung (create-bot)

```typescript
// 1. Prüfen ob User in Team ist
const { data: membership } = await supabase
  .from('team_members')
  .select('team_id, teams(max_minutes)')
  .eq('user_id', user.id)
  .maybeSingle();

if (membership?.team_id) {
  // Team-Kontingent verwenden
  const teamMaxMinutes = membership.teams?.max_minutes ?? 600;
  
  // Alle Team-Mitglieder holen
  const { data: teamMembers } = await supabase
    .from('team_members')
    .select('user_id')
    .eq('team_id', membership.team_id);
  
  const memberIds = teamMembers?.map(m => m.user_id) || [];
  
  // Verbrauch aller Team-Mitglieder summieren
  const { data: teamRecordings } = await supabase
    .from('recordings')
    .select('duration')
    .in('user_id', memberIds)
    .eq('status', 'done');
  
  const teamUsedSeconds = teamRecordings?.reduce(...) || 0;
  const teamUsedMinutes = Math.round(teamUsedSeconds / 60);
  
  if (teamUsedMinutes >= teamMaxMinutes) {
    // Team-Kontingent erschöpft
    return Response(403, 'Team-Kontingent erschöpft');
  }
} else {
  // Individuelles Kontingent (wie bisher)
}
```

## Betroffene Dateien

| Datei | Änderung |
|-------|----------|
| `supabase/migrations/...` | Neue Tabellen + RLS |
| `supabase/functions/admin-create-team/index.ts` | NEU |
| `supabase/functions/admin-update-team/index.ts` | NEU |
| `supabase/functions/admin-delete-team/index.ts` | NEU |
| `supabase/functions/admin-assign-team-member/index.ts` | NEU |
| `supabase/functions/admin-dashboard/index.ts` | Teams-Daten laden |
| `supabase/functions/create-bot/index.ts` | Team-Quota-Check |
| `src/pages/Admin.tsx` | Team-UI + Tabs |
| `src/hooks/useUserQuota.ts` | Team-Support |
| `src/components/quota/QuotaProgressBar.tsx` | Team-Anzeige |
| `src/integrations/supabase/types.ts` | Auto-generiert |

## Risikobewertung

| Risiko | Bewertung | Mitigation |
|--------|-----------|------------|
| Migration Downtime | Niedrig | Nur neue Tabellen, keine Änderungen an bestehenden |
| Quota-Berechnung | Mittel | Ausgiebige Tests mit Team/Einzel-Szenarien |
| Performance | Niedrig | Einfache JOIN-Queries, Index auf team_members.user_id |

