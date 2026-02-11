

## Automatische Recording-Erkennung fuer Kalender-Bots

### Problem
Wenn Recall.ai automatisch einen Bot zu einem Kalender-Meeting sendet, wird kein Eintrag in der `recordings`-Tabelle erstellt. Dadurch erscheint das Meeting nie im Dashboard und kein Transkript wird gespeichert.

Bei manuellen Bots (`create-bot`) wird der Eintrag explizit angelegt (Zeile 488-498 in `create-bot/index.ts`). Diese Logik fehlt fuer automatische Bots.

### Loesung

**Datei: `supabase/functions/recall-calendar-meetings/index.ts`**

In der `list`-Action, nach dem Sortieren der Meetings (Zeile 472), wird folgender Block eingefuegt:

1. Alle Meetings mit `bot_id` sammeln
2. Pruefen ob fuer diese `bot_id`s bereits ein `recordings`-Eintrag existiert (`SELECT recall_bot_id FROM recordings WHERE recall_bot_id IN (...)`)
3. Fuer jede fehlende `bot_id`:
   - Neuen `recordings`-Eintrag erstellen:
     - `recall_bot_id`: die bot_id aus dem Kalender-Meeting
     - `user_id`: der authentifizierte User (supabaseUserId)
     - `meeting_id`: neue UUID via `crypto.randomUUID()`
     - `meeting_url`: extrahierte Meeting-URL
     - `status`: `recording` (Bot ist bereits im Meeting)
     - `source`: `bot`
     - `title`: Meeting-Titel aus dem Kalender
   - Asynchron `sync-recording` aufrufen (via `fetch` an die eigene Edge Function URL mit Service-Role-Key), damit Transkript und Video geholt werden sobald der Bot fertig ist
4. Loggen wie viele Recordings automatisch erzeugt wurden

### Ablauf

```text
Vorher:
  Recall.ai sendet Bot automatisch -> Bot nimmt auf -> Kein DB-Eintrag -> Meeting unsichtbar

Nachher:
  Recall.ai sendet Bot automatisch -> Bot nimmt auf
  Frontend pollt alle 15s "list" -> Meeting hat bot_id
  -> Kein recordings-Eintrag gefunden -> Wird automatisch erstellt
  -> sync-recording wird asynchron getriggert
  -> Meeting erscheint sofort im Dashboard
  -> Transkript wird automatisch synchronisiert
```

### Keine weiteren Dateien betroffen
- `useRecallCalendarMeetings.ts`: Keine Aenderung noetig (nutzt bestehende Polling-Logik)
- `create-bot/index.ts`: Keine Aenderung (manuelle Bots funktionieren weiterhin wie bisher)
- `sync-recording/index.ts`: Keine Aenderung (wird nur asynchron aufgerufen)

### Sicherheit
- Recording wird nur fuer den authentifizierten User erstellt (auth.uid = user_id)
- Duplikate werden durch Vorab-Check auf existierende `recall_bot_id` verhindert
- Service-Role-Key wird nur intern fuer den sync-recording Aufruf verwendet
