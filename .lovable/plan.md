

## Problem

Die Aufnahme-Einstellungen (z.B. "Automatische Aufnahme") werden beim Seitenladen nie vom Server geladen. Der Hook startet immer mit fest codierten Standardwerten (`auto_record: false`), obwohl im Backend der gespeicherte Wert `true` sein kann. Das fuehrt dazu, dass die Schalter nach jedem Neuladen falsch stehen -- die Automation bleibt aber im Hintergrund aktiv.

## Loesung

Beim Laden der Seite die gespeicherten Einstellungen aus der Datenbank (`recall_calendar_users.recording_preferences`) abrufen und in den State uebernehmen.

## Technische Details

### 1. Neue Backend-Aktion `get_preferences` (Edge Function)

In `supabase/functions/recall-calendar-meetings/index.ts` eine neue Aktion hinzufuegen:

- Aktion: `get_preferences`
- Liest `recording_preferences` aus der `recall_calendar_users`-Tabelle fuer den authentifizierten Benutzer
- Gibt die gespeicherten Einstellungen zurueck (oder Standardwerte, falls noch keine vorhanden)

### 2. Preferences beim Start laden (Frontend Hook)

In `src/hooks/useRecallCalendarMeetings.ts`:

- Neue Funktion `loadPreferences` hinzufuegen, die `get_preferences` aufruft
- Diese Funktion beim Start ausfuehren (per `useEffect`), sobald `authUser` verfuegbar ist
- Die geladenen Werte in den `preferences`-State uebernehmen

### Betroffene Dateien

| Datei | Aenderung |
|-------|-----------|
| `supabase/functions/recall-calendar-meetings/index.ts` | Neue Aktion `get_preferences` |
| `src/hooks/useRecallCalendarMeetings.ts` | `loadPreferences` hinzufuegen und beim Start aufrufen |

