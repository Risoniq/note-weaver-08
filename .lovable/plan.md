

# Plan: Admin-Berechtigung zum Bearbeiten aller Meeting-Titel

## Problem-Analyse

Aktuell kann ein Admin zwar alle Meetings **sehen** (dank RLS SELECT Policy + Edge Functions), aber nicht **bearbeiten**:

| Aktion | Normale User | Admin |
|--------|-------------|-------|
| Eigene Recordings lesen | ✅ (RLS) | ✅ (RLS) |
| Alle Recordings lesen | ❌ | ✅ (RLS Policy) |
| Eigene Recordings bearbeiten | ✅ (RLS) | ✅ (RLS) |
| **Fremde Recordings bearbeiten** | ❌ | ❌ ← **Problem** |

## Lösungsansatz

Es gibt zwei Wege:

**Option A: Neue RLS UPDATE Policy für Admins**
- Einfach eine neue RLS Policy hinzufügen: `Admins can update all recordings`
- Vorteil: Schnell, keine Code-Änderungen nötig
- Nachteil: Gibt Admins volle Schreibrechte auf alle Felder

**Option B: Edge Function für Admin-Updates (sicherer)**
- Neue Aktion `update_recording_title` in `admin-view-user-data` Edge Function
- Frontend erkennt Admin-Modus und nutzt Edge Function statt direkte DB-Abfrage
- Vorteil: Granulare Kontrolle (nur Titel änderbar), auditierbar
- Nachteil: Mehr Code-Änderungen

**Empfehlung: Option A** (einfach + effektiv, da Admins ohnehin Vertrauen genießen)

## Umsetzungsschritte

### 1. Datenbank-Migration: RLS UPDATE Policy für Admins

```sql
CREATE POLICY "Admins can update all recordings"
ON public.recordings
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));
```

### 2. Frontend: EditableTitle Admin-Aware machen

Da Admins im Impersonation-Modus die Seite über `/meeting/:id` aufrufen und `isAdmin && isImpersonating` true ist, könnte RLS das Update dennoch blockieren. Der Admin-Client nutzt denselben Supabase-Client, aber mit seinem eigenen Token.

**Lösung**: Die neue RLS Policy erlaubt Admins Updates auf alle Recordings direkt - keine Code-Änderung in `EditableTitle` nötig!

**Optional (Robustheit)**: Falls es dennoch Probleme gibt, kann `EditableTitle` ein `isAdmin`-Prop bekommen und bei Bedarf eine Edge Function nutzen.

## Betroffene Dateien

| Datei | Änderung |
|-------|----------|
| `supabase/migrations/...` | Neue RLS UPDATE Policy für Admins |
| `src/components/recordings/EditableTitle.tsx` | Keine Änderung nötig (Policy reicht) |

## Technische Details

### Migration SQL

```sql
-- Admins dürfen alle Recordings aktualisieren
CREATE POLICY "Admins can update all recordings"
ON public.recordings
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));
```

### Warum das funktioniert

1. Admin öffnet MeetingDetail im Impersonation-Modus
2. Recording wird via Edge Function geladen (umgeht RLS für SELECT)
3. Admin ändert den Titel via `EditableTitle`
4. `EditableTitle` macht ein direktes `supabase.from('recordings').update(...)` 
5. RLS prüft: `has_role(auth.uid(), 'admin')` → **true**
6. Update wird durchgeführt

## Testplan

1. Als Admin einloggen und "Ansicht anzeigen" für einen User aktivieren
2. Ein Meeting des Users öffnen
3. Titel bearbeiten und speichern
4. Seite neu laden → Titel sollte dauerhaft geändert sein
5. Als der echte User einloggen und prüfen ob der Titel geändert wurde

## Risiko-Bewertung

- **Niedrig**: Admins haben bereits Lese-Zugriff auf alle Daten
- Die UPDATE Policy ist auf `has_role(..., 'admin')` beschränkt
- Normale User können weiterhin nur eigene Recordings bearbeiten

