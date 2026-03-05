

# Action-Item Completion Tracking: Person + Datum anzeigen

## Aenderungen

### 1. DB-Migration: `completed_by_email` Spalte hinzufuegen
- Neue Spalte `completed_by_email TEXT` in `action_item_completions`
- Speichert die E-Mail des Users, der den Punkt abgehakt hat (denormalisiert fuer schnelle Anzeige ohne Auth-Lookup)

### 2. `src/hooks/useActionItemCompletions.ts` anpassen
- `Completion` Interface erweitern um `completed_by_email: string`
- Beim Laden: `completed_by_email` mitlesen
- Beim Insert: `session.user.email` als `completed_by_email` mitspeichern
- Neue Funktion `completedByEmail(recordingId, itemIndex)` exportieren

### 3. Alle 4 Anzeige-Stellen aktualisieren
In jeder Stelle wo `doneAt` angezeigt wird, zusaetzlich den Namen/die E-Mail anzeigen:

| Datei | Zeilen |
|---|---|
| `src/pages/MeetingDetail.tsx` | ~1093-1096 |
| `src/components/dashboard/AccountAnalyticsModal.tsx` | ~239-244 |
| `src/components/meeting/MeetingDetailModal.tsx` | Action Items Bereich |
| `src/components/recordings/RecordingDetailSheet.tsx` | ~174-178 |

Anzeige-Format: `erledigt von user@email.de am 27.02.`

