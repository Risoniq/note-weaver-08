

## Soft-Delete fuer Meetings mit Wiederherstellung im Admin Dashboard

Statt Meetings dauerhaft zu loeschen, werden sie als "geloescht" markiert (Soft-Delete). Im normalen Dashboard sind sie unsichtbar, im Admin Dashboard werden sie mit rotem Rahmen angezeigt und koennen wiederhergestellt werden.

### Ablauf

1. **Datenbank-Migration**: Neue Spalte `deleted_at` (timestamp, nullable) zur `recordings`-Tabelle hinzufuegen. NULL = aktiv, Wert = geloescht.

2. **RLS-Policies anpassen**: Die bestehenden SELECT-Policies fuer normale User und Teamleads werden um `AND deleted_at IS NULL` ergaenzt, sodass geloeschte Meetings automatisch herausgefiltert werden. Die Admin-SELECT-Policy bleibt unveraendert (sieht alles).

3. **Loeschen-Button auf Meeting-Detail-Seite** (`src/pages/MeetingDetail.tsx`): Statt `DELETE` wird ein `UPDATE` mit `deleted_at = now()` ausgefuehrt. Bestaetigung ueber AlertDialog, danach Navigation zurueck zur Startseite.

4. **Admin Dashboard anpassen** (`src/pages/Admin.tsx` / Impersonation-View): Geloeschte Meetings werden mit rotem Rahmen (`border-2 border-red-500`) und einem "Geloescht"-Badge angezeigt. Ein "Wiederherstellen"-Button setzt `deleted_at` zurueck auf NULL.

5. **RecordingCard anpassen** (`src/components/recordings/RecordingCard.tsx`): Optionaler `isDeleted`-Prop fuer roten Rahmen im Admin-View.

6. **Edge Functions anpassen**: `admin-view-user-data` und `admin-dashboard` muessen geloeschte Recordings mitzaehlen/anzeigen, aber in den Statistiken als separat markieren.

### Technische Details

| Datei | Aenderung |
|---|---|
| Migration (SQL) | `ALTER TABLE recordings ADD COLUMN deleted_at timestamptz DEFAULT NULL` |
| Migration (SQL) | RLS-Policy `Users can view own recordings` ergaenzen: `auth.uid() = user_id AND deleted_at IS NULL` |
| Migration (SQL) | RLS-Policy `Teamleads can view team recordings` ergaenzen: `... AND recordings.deleted_at IS NULL` |
| `src/pages/MeetingDetail.tsx` | Loeschen-Button mit Soft-Delete (`UPDATE ... SET deleted_at = now()`) und AlertDialog |
| `src/components/recordings/RecordingCard.tsx` | `isDeleted`-Prop fuer roten Rahmen |
| `src/components/recordings/RecordingsList.tsx` | Keine Aenderung noetig (RLS filtert automatisch) |
| `supabase/functions/admin-view-user-data/index.ts` | Geloeschte Recordings mit `deleted_at`-Feld zurueckgeben |
| `src/types/recording.ts` | `deleted_at` Feld zum Interface hinzufuegen |

### Verhalten

- **User loescht Meeting**: `deleted_at` wird gesetzt, Meeting verschwindet aus Dashboard und Aufnahmen-Liste
- **Admin sieht alles**: Geloeschte Meetings haben roten Rahmen + "Geloescht am..."-Badge + Wiederherstellen-Button
- **Admin stellt wieder her**: `deleted_at` wird auf NULL gesetzt, Meeting erscheint wieder beim User
- **Quota**: Geloeschte Meetings zaehlen weiterhin zum Kontingent (Minuten bleiben verbraucht)

