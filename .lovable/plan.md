

# Fix: Webhook-zu-Sync Feld-Mismatch und Analyse-Zuverlaessigkeit

## Problem (Ursache gefunden)

In `recall-status-webhook` wird der `sync-recording`-Aufruf mit dem falschen Feldnamen gemacht:

```
// Webhook sendet:
body: JSON.stringify({ recordingId: recording.id })

// Aber sync-recording erwartet:
const { id, force_resync = false } = await req.json()
```

`id` ist daher immer `undefined`, die Recording wird nicht gefunden, und weder Transkript-Download noch Analyse werden ausgefuehrt. Der Webhook laeuft zwar, aber bewirkt nichts.

Zum Vergleich: `auto-sync-recordings` macht es richtig mit `{ id: recording.id }`.

## Aenderungen

### 1. Feld-Name korrigieren in `recall-status-webhook`
**Datei:** `supabase/functions/recall-status-webhook/index.ts` (Zeile 115)

Aenderung von `recordingId` zu `id`:
```ts
// Vorher:
body: JSON.stringify({ recordingId: recording.id }),

// Nachher:
body: JSON.stringify({ id: recording.id }),
```

### 2. Retry-Logik bei `call_ended` hinzufuegen
`call_ended` kommt oft bevor Recall.ai die Aufnahme fertig verarbeitet hat. Wenn `sync-recording` zu diesem Zeitpunkt laeuft, findet es evtl. noch kein Transkript. Loesung: Bei `call_ended` eine kurze Verzoegerung einbauen und den Status `done` abwarten bevor gesynct wird.

**Datei:** `supabase/functions/recall-status-webhook/index.ts`

- Bei `call_ended`: Status in DB auf `processing` setzen, aber KEINEN Sync triggern (Recall.ai sendet danach noch `done`)
- `call_ended` aus `SYNC_TRIGGER_STATUSES` entfernen
- Nur `done`, `recording_done`, `analysis_done`, `fatal`, `media_expired` triggern den Sync

### 3. Status `transcribing` nicht als "already done" behandeln
Aktuell blockiert die Pruefung `recording.status === 'done'` einen Re-Sync. Aber Recordings im Status `transcribing` sollten ebenfalls erneut gesynct werden koennen, da das Transkript dann fertig sein koennte.

**Datei:** `supabase/functions/recall-status-webhook/index.ts`

Die Pruefung auf Zeile 98 aendern: Nur wenn Status `done` ist, wird der Sync uebersprungen. `transcribing` wird durchgelassen.

## Betroffene Datei

| Datei | Aenderung |
|-------|-----------|
| `supabase/functions/recall-status-webhook/index.ts` | Feld-Name Fix (`id` statt `recordingId`), `call_ended` nicht mehr als Sync-Trigger, Zwischen-Status-Updates verbessern |

## Zusammenfassung

Der Hauptfehler war ein simpler Tippfehler: `recordingId` statt `id`. Dadurch hat der gesamte Echtzeit-Webhook-Flow nie funktioniert -- die Analyse wurde nur durch den 5-Minuten-Cron-Job (`auto-sync-recordings`) oder manuelles Frontend-Polling gestartet, was erklaert warum es "sich aufhaengt".

