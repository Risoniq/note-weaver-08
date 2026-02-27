

# To-Dos abhakbar machen mit Persistierung

## Neue Datenbank-Tabelle

`action_item_completions` — speichert welcher Action Item abgehakt wurde:

```text
id          uuid  PK  default gen_random_uuid()
user_id     uuid  NOT NULL
recording_id uuid NOT NULL
item_index  integer NOT NULL  (Index des Action Items im Array)
completed_at timestamptz NOT NULL default now()
UNIQUE(user_id, recording_id, item_index)
```

RLS: User kann nur eigene Eintraege sehen/erstellen/loeschen.

## Neuer Hook: `useActionItemCompletions`

- Laed alle Completions fuer eine Liste von Recording-IDs
- Bietet `toggleCompletion(recordingId, itemIndex)` — fuegt hinzu oder entfernt
- Gibt ein Set zurueck: `isCompleted(recordingId, itemIndex) → boolean`
- Gibt `completedAt(recordingId, itemIndex) → Date | null` zurueck

## UI-Aenderungen

### MeetingDetail.tsx (Zeilen 1063-1087)
- Action Items bekommen eine funktionale Checkbox (statt nur Hover-Effekt)
- Abgehakte Items: durchgestrichen, Datum daneben angezeigt ("erledigt am 27.02.")

### AccountAnalyticsModal.tsx (Zeilen 201-226)
- `Checkbox` wird klickbar statt `disabled`
- Abgehakte Items visuell markiert mit Datum
- Zaehler in den Statistiken: "3/8 erledigt"

### MeetingDetailModal.tsx (Zeilen 124-143)
- Checkboxen werden funktional mit Persist

### RecordingDetailSheet.tsx (Zeilen 136-155)
- Gleiche Logik wie oben

## Betroffene Dateien

| Datei | Aenderung |
|---|---|
| Migration | Neue Tabelle `action_item_completions` mit RLS |
| `src/hooks/useActionItemCompletions.ts` | Neuer Hook |
| `src/pages/MeetingDetail.tsx` | Checkboxen funktional machen |
| `src/components/dashboard/AccountAnalyticsModal.tsx` | Checkboxen aktivieren + Zaehler |
| `src/components/meeting/MeetingDetailModal.tsx` | Checkboxen funktional |
| `src/components/recordings/RecordingDetailSheet.tsx` | Checkboxen funktional |

