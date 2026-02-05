

## Bug-Fix: Analyse wird nicht ausgelöst

### Problem gefunden
Die `transcribe-audio` Edge Function ruft `analyze-transcript` auf, aber der Parameter-Name stimmt nicht überein:

| Gesendet (transcribe-audio) | Erwartet (analyze-transcript) |
|----------------------------|-------------------------------|
| `recordingId` | `recording_id` |

Dadurch schlägt die Analyse fehl mit "recording_id is required".

---

## Änderungen

### 1. Parameter-Name korrigieren
**Datei:** `supabase/functions/transcribe-audio/index.ts`

Zeile 200 ändern von:
```typescript
body: JSON.stringify({ recordingId: recording.id }),
```
zu:
```typescript
body: JSON.stringify({ recording_id: recording.id }),
```

---

## Technische Details

| Komponente | Änderung |
|------------|----------|
| `transcribe-audio/index.ts` | Parameter-Name von `recordingId` auf `recording_id` korrigieren |

## Ergebnis
Nach dieser Korrektur wird die KI-Analyse (Titel, Summary, Key Points, Action Items) automatisch nach der Transkription ausgelöst und die Ergebnisse werden in der Datenbank gespeichert.

