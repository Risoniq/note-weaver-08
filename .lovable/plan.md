

## Fix: Auto-Ingest erstellt Recordings fuer zukuenftige Meetings

### Problem

Die Auto-Ingest-Logik in der `recall-calendar-meetings` Edge Function (Zeile 476) erstellt Recording-Eintraege fuer **alle** Kalender-Meetings, die eine `bot_id` haben - auch fuer Meetings, die erst morgen oder spaeter stattfinden. Das fuehrt dazu, dass auf der Aufnahmen-Seite viele Meetings mit dem Status "Aufnahme laeuft" angezeigt werden, obwohl diese noch gar nicht begonnen haben.

### Ursache

```typescript
// Aktuell: filtert nur nach bot_id, ignoriert Zeitpunkt
const meetingsWithBots = meetings.filter((m: any) => m.bot_id);
```

### Loesung

Die Auto-Ingest-Logik soll nur Meetings beruecksichtigen, deren `start_time` in der Vergangenheit liegt (also Meetings die bereits begonnen haben oder laufen). Zukuenftige Meetings sollen ignoriert werden.

### Aenderungen

**1. Edge Function `recall-calendar-meetings/index.ts` (Zeile 476)**

Filter erweitern: Nur Meetings mit `bot_id` UND `start_time <= jetzt` werden auto-ingested.

```typescript
const now = new Date();
const meetingsWithBots = meetings.filter((m: any) => 
  m.bot_id && new Date(m.start_time) <= now
);
```

**2. Aufraumen: Falsch erstellte Recordings loeschen**

Die bereits faelschlich erstellten Recordings fuer den User as@ec-pd.com muessen bereinigt werden. Ueber eine Datenbank-Migration werden alle Recordings mit Status "recording" oder "pending" geloescht, die am 2026-02-12 um 20:27 massenweise erstellt wurden (erkennbar daran, dass alle innerhalb einer Sekunde erstellt wurden und keinen Transcript/Video haben).

SQL-Migration:
```sql
DELETE FROM recordings
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'as@ec-pd.com')
  AND status IN ('pending', 'recording')
  AND created_at >= '2026-02-12T20:27:22Z'
  AND created_at <= '2026-02-12T20:27:24Z'
  AND transcript_text IS NULL
  AND video_url IS NULL;
```

### Zusammenfassung

| Datei | Aenderung |
|-------|-----------|
| `supabase/functions/recall-calendar-meetings/index.ts` | Filter um Zeitpruefung erweitern (nur vergangene/laufende Meetings) |
| Migration SQL | Falsch erstellte Recordings bereinigen |

