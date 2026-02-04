# Plan: Team-Funktionalität mit Teamlead-Rolle

## Status: ✅ VOLLSTÄNDIG IMPLEMENTIERT

---

## Übersicht

Implementierung einer Team-Verwaltung mit:
- Gemeinsames Meeting-Kontingent für Team-Mitglieder
- **Teamlead-Rolle** mit Einsicht in alle Team-Meetings und Statistiken
- Admin-Dashboard für Team- und Rollenverwaltung

---

## Rollenmodell

```text
┌────────────────────────────────────────────────────────────┐
│                      ADMIN                                  │
│  - Vollzugriff auf alle Daten                              │
│  - Kann Teams/User verwalten                               │
│  - Kann Rollen zuweisen (Teamlead/Member)                  │
└────────────────────────────────────────────────────────────┘
                           │
┌────────────────────────────────────────────────────────────┐
│                     TEAMLEAD                                │
│  - Sieht Meetings aller Team-Mitglieder                    │
│  - Sieht Team-Statistiken im Dashboard                     │
│  - Toggle: "Meine" / "Team" Ansicht                        │
│  - Kann eigene Meetings aufnehmen                          │
│  - Keine Verwaltungsrechte                                 │
└────────────────────────────────────────────────────────────┘
                           │
┌────────────────────────────────────────────────────────────┐
│                    MEMBER (Subuser)                         │
│  - Sieht nur eigene Meetings                               │
│  - Teilt Team-Kontingent                                   │
└────────────────────────────────────────────────────────────┘
```

---

## Implementierte Features

### Phase 1: Datenbank ✅
- [x] `teams` Tabelle (id, name, max_minutes)
- [x] `team_members` Tabelle (team_id, user_id, role)
- [x] RLS Policies für Admin-Zugriff
- [x] RLS Policy "Teamleads can view team recordings"
- [x] Index auf team_members.role

### Phase 2: Backend ✅
- [x] `admin-create-team` Edge Function
- [x] `admin-update-team` Edge Function
- [x] `admin-delete-team` Edge Function
- [x] `admin-assign-team-member` (role Parameter + set-role Action)
- [x] `teamlead-recordings` Edge Function
- [x] `admin-dashboard` erweitert (team_role, leads Array)
- [x] `create-bot` Quota-Check für Teams

### Phase 3: Frontend - Admin ✅
- [x] Teams-Tab im Admin-Dashboard
- [x] TeamCard mit Kontingent-Anzeige und Lead-Badge (Crown Icon)
- [x] TeamDialog für Erstellen/Bearbeiten
- [x] TeamMembersDialog mit Rollen-Dropdown (Mitglied/Teamlead)
- [x] Team-Zuordnung in Benutzer-Tabelle

### Phase 4: Frontend - User Experience ✅
- [x] `useTeamleadCheck` Hook
- [x] `useUserQuota` Hook (Team-Support)
- [x] Dashboard: Team-Toggle für Teamleads (Meine/Team)
- [x] RecordingsList: Team-Modus mit Owner-Badge
- [x] TeamAnalyticsCard für Team-Statistiken
- [x] QuotaProgressBar: Team-Kontingent-Anzeige
- [x] Transkripte: Team-Filter + Member-Dropdown

---

## Betroffene Dateien

### Neue Dateien
- `supabase/functions/admin-create-team/index.ts`
- `supabase/functions/admin-update-team/index.ts`
- `supabase/functions/admin-delete-team/index.ts`
- `supabase/functions/admin-assign-team-member/index.ts`
- `supabase/functions/teamlead-recordings/index.ts`
- `src/hooks/useTeamleadCheck.ts`
- `src/components/admin/TeamCard.tsx`
- `src/components/admin/TeamDialog.tsx`
- `src/components/admin/TeamMembersDialog.tsx`
- `src/components/dashboard/TeamAnalyticsCard.tsx`

### Geänderte Dateien
- `supabase/functions/admin-dashboard/index.ts`
- `supabase/functions/create-bot/index.ts`
- `src/pages/Admin.tsx`
- `src/pages/Index.tsx`
- `src/pages/Transcripts.tsx`
- `src/hooks/useUserQuota.ts`
- `src/components/quota/QuotaProgressBar.tsx`
- `src/components/recordings/RecordingsList.tsx`

---

## Sicherheit

| Aspekt | Implementierung |
|--------|-----------------|
| RLS für Recordings | Teamleads nur SELECT, kein UPDATE/DELETE |
| Backend-Validierung | Edge Functions prüfen Teamlead-Status |
| Keine Admin-Rechte | Teamlead kann keine Benutzer verwalten |
| Team-Isolation | Teamlead sieht nur sein eigenes Team |
