
# Kalender-Automatik standardmäßig deaktivieren

## Übersicht

Die automatische Bot-Teilnahme an Meetings soll standardmäßig **deaktiviert** sein. Benutzer müssen die Funktion explizit einschalten.

## Änderungen

### 1. Frontend-Hook: useRecallCalendarMeetings.ts

**Datei:** `src/hooks/useRecallCalendarMeetings.ts`

Zeile 77-82 ändern:

```typescript
const [preferences, setPreferences] = useState<RecordingPreferences>({
  record_all: true,
  record_only_owned: false,
  record_external: true,
  auto_record: false,  // ← von true auf false
});
```

### 2. Älterer Hook: useRecallCalendar.ts

**Datei:** `src/hooks/useRecallCalendar.ts`

Zeile 46-50 ändern:

```typescript
const [preferences, setPreferences] = useState<RecordingPreferences>({
  record_all: true,
  record_only_owned: false,
  record_external: true,
  auto_record: false,  // ← von true auf false
});
```

### 3. Backend Edge Function: recall-calendar-meetings

**Datei:** `supabase/functions/recall-calendar-meetings/index.ts`

Zeile 688-692 in der `init_preferences` Aktion ändern:

```typescript
const defaultPreferences = {
  record_all: true,
  record_only_owned: false,
  record_external: true,
  auto_record: false,  // ← von true auf false
};
```

## Ergebnis

Nach dieser Änderung:
- Neue Benutzer haben die Kalender-Automatik **standardmäßig deaktiviert**
- Der Bot tritt erst automatisch Meetings bei, wenn der Benutzer "Automatische Aufnahme" auf der Kalender-Seite aktiviert
- Bestehende Benutzer mit bereits gespeicherten Einstellungen sind nicht betroffen (ihre Einstellungen bleiben erhalten)

## Technischer Hinweis

Die Einstellungen werden serverseitig in der `recall_calendar_users` Tabelle gespeichert. Die Frontend-Defaults dienen nur als Fallback, bis die tatsächlichen Einstellungen vom Server geladen wurden.
