

## Meetings zwischen Usern teilen und Teamlead-Verwaltung

### Bestandsaufnahme

Die Teamlead-Funktion existiert bereits vollstaendig:
- Admins koennen im Team-Mitglieder-Dialog die Rolle "Teamlead" vergeben
- Teamleads sehen alle Meetings ihres Teams ueber die RLS-Policy "Teamleads can view team recordings"
- Toggle zwischen "Meine Meetings" und "Team-Meetings" in der Recordings- und Transkript-Ansicht

### Neue Funktion: Meetings teilen zwischen Usern

Zwei User (egal ob gleiche Berechtigung oder nicht) sollen einzelne Meetings miteinander teilen koennen, sodass beide Einsicht in das Meeting haben.

### Datenbank-Aenderungen

**Neue Tabelle `shared_recordings`:**

| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| id | uuid | Primaerschluessel |
| recording_id | uuid | Referenz auf das Recording |
| shared_by | uuid | User der das Meeting teilt |
| shared_with | uuid | User der Zugriff erhaelt |
| created_at | timestamptz | Zeitstempel |

**RLS-Policies:**
- SELECT: User kann Eintraege sehen wo er `shared_by` oder `shared_with` ist
- INSERT: User kann nur eigene Recordings teilen (`shared_by = auth.uid()` und Recording gehoert dem User)
- DELETE: Nur der `shared_by`-User kann die Freigabe widerrufen

**Neue RLS-Policy auf `recordings`:**
- SELECT: User kann Recordings sehen die mit ihm geteilt wurden (via `shared_recordings`-Tabelle)

### Frontend-Aenderungen

**1. Share-Button auf der MeetingDetail-Seite (`src/pages/MeetingDetail.tsx`)**
- Neues "Teilen"-Icon neben den bestehenden Aktions-Buttons
- Oeffnet einen Dialog zum Teilen

**2. Neuer ShareRecordingDialog (`src/components/meeting/ShareRecordingDialog.tsx`)**
- Eingabefeld fuer die E-Mail des Empfaengers
- Liste der aktuell geteilten User mit Moeglichkeit zum Entfernen
- Suche nach registrierten Usern ueber eine Edge Function

**3. Edge Function `share-recording` (`supabase/functions/share-recording/index.ts`)**
- Aktionen: `share` (Freigabe erteilen), `unshare` (Freigabe entziehen), `list` (geteilte User auflisten)
- Prueft ob der anfragende User der Owner des Recordings ist
- Sucht den Ziel-User anhand der E-Mail-Adresse

**4. Kennzeichnung geteilter Meetings in der RecordingsList**
- Badge "Geteilt von [Name]" bei Recordings die von anderen Usern geteilt wurden
- Geteilte Meetings erscheinen in der normalen Recordings-Liste des Empfaengers

### Technische Details

```text
Ablauf: Meeting teilen
+------------------+     +------------------+     +------------------+
| MeetingDetail    | --> | ShareDialog      | --> | share-recording  |
| (Share-Button)   |     | (E-Mail eingeben)|     | Edge Function    |
+------------------+     +------------------+     +------------------+
                                                         |
                                                         v
                                              +---------------------+
                                              | shared_recordings   |
                                              | Tabelle (INSERT)    |
                                              +---------------------+
                                                         |
                                                         v
                                              +---------------------+
                                              | RLS-Policy auf      |
                                              | recordings (SELECT) |
                                              +---------------------+
```

**Edge Function `share-recording`:**
- Authentifizierung via JWT
- Action `share`: E-Mail entgegennehmen, User-ID auflösen (via admin.listUsers), Eintrag in `shared_recordings` erstellen
- Action `unshare`: Eintrag loeschen
- Action `list`: Alle geteilten User fuer ein Recording auflisten (mit E-Mails)

**RLS-Policy fuer geteilte Recordings:**
```sql
CREATE POLICY "Users can view shared recordings"
ON recordings FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM shared_recordings
    WHERE shared_recordings.recording_id = recordings.id
    AND shared_recordings.shared_with = auth.uid()
    AND recordings.deleted_at IS NULL
  )
);
```

**RecordingsList-Anpassung (`src/components/recordings/RecordingsList.tsx`):**
- Geteilte Recordings werden automatisch via die neue RLS-Policy mitgeladen
- Ein JOIN oder separater Query auf `shared_recordings` zeigt an, ob ein Recording geteilt wurde und von wem

### Zusammenfassung der Dateien

| Datei | Aenderung |
|-------|-----------|
| Migration SQL | Neue Tabelle `shared_recordings` + RLS-Policies |
| `supabase/functions/share-recording/index.ts` | Neue Edge Function |
| `src/components/meeting/ShareRecordingDialog.tsx` | Neuer Dialog |
| `src/pages/MeetingDetail.tsx` | Share-Button hinzufuegen |
| `src/components/recordings/RecordingCard.tsx` | Badge "Geteilt von..." |
| `src/components/recordings/RecordingsList.tsx` | Geteilte Recordings anzeigen |

