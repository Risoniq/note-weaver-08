

# Fix: Bot tritt automatisch Meetings bei trotz deaktivierter Einstellung

## Problem

Die Code-Aenderung von `syncPreferencesToRecall` ist korrekt implementiert, aber es gibt zwei verbleibende Probleme:

1. **Bestehende Nutzer**: 4 von 7 Nutzern haben noch `auto_record: true` in der Datenbank. Ihre Recall.ai-Einstellungen wurden seit dem Fix nicht neu synchronisiert.
2. **Kein automatischer Re-Sync**: Die Praeferenzen werden nur bei explizitem `update_preferences`-Aufruf an Recall.ai gesendet. Wenn ein Nutzer die Einstellungen nie aendert, bleibt der alte (falsche) Zustand bei Recall.ai bestehen.

## Loesung

### Schritt 1: Bestehende Nutzer auf `auto_record: false` setzen

Alle Nutzer, die noch `auto_record: true` haben, werden per Daten-Update auf `false` gesetzt (ausser sie haben es bewusst aktiviert). Da das Problem war, dass der Default `true` war, muessen wir davon ausgehen, dass keiner dieser Nutzer die Funktion bewusst aktiviert hat.

```sql
UPDATE recall_calendar_users
SET recording_preferences = jsonb_set(recording_preferences, '{auto_record}', 'false')
WHERE recording_preferences->>'auto_record' = 'true';
```

### Schritt 2: Praeferenz-Sync bei jedem Kalenderseiten-Aufruf

In `supabase/functions/recall-calendar-meetings/index.ts` wird beim `list`-Action ein automatischer Re-Sync der Praeferenzen an Recall.ai ausgefuehrt. Damit wird sichergestellt, dass Recall.ai immer den aktuellen Stand aus der Datenbank hat.

**Datei:** `supabase/functions/recall-calendar-meetings/index.ts`

Innerhalb des `if (action === 'list')` Blocks, nach dem Abruf der `recallUserId`, wird folgender Code eingefuegt:

```typescript
// Re-sync preferences to Recall.ai on every list call to ensure consistency
try {
  const { data: calUser } = await supabase
    .from('recall_calendar_users')
    .select('recording_preferences, bot_name, bot_avatar_url')
    .eq('supabase_user_id', supabaseUserId)
    .maybeSingle();
  
  if (calUser?.recording_preferences) {
    const prefs = calUser.recording_preferences;
    const botConfig = {
      bot_name: calUser.bot_name || undefined,
      bot_avatar_url: calUser.bot_avatar_url || undefined,
    };
    console.log('[list] Re-syncing preferences to Recall.ai, auto_record:', prefs.auto_record);
    await syncPreferencesToRecall(recallUserId, prefs, botConfig);
  }
} catch (syncErr) {
  console.error('[list] Non-critical: preference sync failed:', syncErr);
}
```

Dies stellt sicher, dass beim naechsten Oeffnen der Kalenderseite (oder jedem API-Aufruf der Meeting-Liste) die korrekten Praeferenzen an Recall.ai uebertragen werden.

## Zusammenfassung

| Aenderung | Typ |
|-----------|-----|
| `recall_calendar_users.recording_preferences` auf `auto_record: false` fuer alle bestehenden Nutzer | Daten-Update |
| Re-Sync bei `list`-Action in `recall-calendar-meetings` Edge Function | Code-Aenderung |

## Erwartetes Ergebnis

- Alle bestehenden Nutzer haben `auto_record: false` in der Datenbank
- Beim naechsten Laden der Kalenderseite wird Recall.ai automatisch mit `record_external: false` und `record_internal: false` konfiguriert
- Der Bot tritt bei keinem Meeting mehr automatisch bei, bis der Nutzer dies explizit aktiviert

