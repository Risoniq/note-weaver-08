

## Ziel
Zwei Probleme beheben:
1. **Neuladen von Transkripten schlägt fehl** - für alle User ermöglichen
2. **Hochgeladene Audio-Dateien werden nicht analysiert** - Key Points und To-Dos fehlen

## Diagnose

### Problem 1: Sync-Recording schlägt fehl (404)

| Check | Ergebnis |
|-------|----------|
| `sync-recording` Edge Function | **404 Not Found** |
| Import-Syntax | Veraltet (`https://esm.sh/`) |
| Logs | Keine (Anfragen kommen nicht an) |

**Ursache:** Die `sync-recording` Funktion verwendet veraltete URL-basierte Imports, die Deployment-Fehler verursachen.

### Problem 2: Audio-Upload-Analyse fehlt (404)

| Check | Ergebnis |
|-------|----------|
| `analyze-transcript` Edge Function | **404 Not Found** |
| Import-Syntax | Bereits korrekt (`npm:@supabase/supabase-js@2`) |
| Trigger | `transcribe-audio` ruft `analyze-transcript` auf |

**Ursache:** Die `analyze-transcript` Funktion ist zwar korrekt geschrieben, aber nicht deployed.

### Ablauf bei Audio-Upload

```text
                                                    
  +------------------+    +-------------------+    +--------------------+
  |  AudioUploadCard |    | transcribe-audio  |    | analyze-transcript |
  |    (Frontend)    |--->|  (ElevenLabs STT) |--->|   (Lovable AI)     |
  +------------------+    +-------------------+    +--------------------+
                                    |                      |
                                    |                      |
                                    v                      v
                           Transkript speichern   Key Points, To-Dos,
                           in recordings          Summary speichern
```

Die Kette bricht ab, weil `analyze-transcript` nicht deployed ist (404).

---

## Umsetzungsplan

### Schritt 1: sync-recording auf moderne Imports migrieren

**Datei:** `supabase/functions/sync-recording/index.ts`

Änderungen:
- Zeile 1: `import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'`
  - Ersetzen durch: `import { createClient } from 'npm:@supabase/supabase-js@2'`
- Rest des Codes bleibt unverändert (Funktion verwendet bereits `Deno.serve()`)

### Schritt 2: Beide Funktionen deployen

Nach der Code-Aktualisierung gezielt deployen:
- `sync-recording`
- `analyze-transcript`

### Schritt 3: Deployment verifizieren

Per Test-Aufruf prüfen:
- `sync-recording` sollte 401 (Unauthorized) statt 404 zurückgeben
- `analyze-transcript` sollte 401 statt 404 zurückgeben

---

## Technische Details

### Betroffene Dateien

| Datei | Änderung | Status |
|-------|----------|--------|
| `supabase/functions/sync-recording/index.ts` | Import-Migration (Zeile 1) | Änderung erforderlich |
| `supabase/functions/analyze-transcript/index.ts` | Keine | Nur Deployment |

### Code-Änderung

```typescript
// ALT (Zeile 1 in sync-recording/index.ts):
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// NEU:
import { createClient } from 'npm:@supabase/supabase-js@2'
```

### Verbleibende Funktionen mit veralteten Imports

Diese sind für das aktuelle Problem nicht relevant, sollten aber zukünftig migriert werden:

- `admin-*` Funktionen (28+ Funktionen)
- `api-*` Funktionen
- `create-bot`, `start-meeting-bot`
- `bulk-export-recordings`, `repair-all-recordings`
- etc.

---

## Akzeptanzkriterien

- `sync-recording` antwortet nicht mehr mit 404
- `analyze-transcript` antwortet nicht mehr mit 404
- Transkripte können über den "Neu laden" Button erfolgreich synchronisiert werden
- Hochgeladene Audio-Dateien erhalten nach der Transkription automatisch Key Points, To-Dos und Summary

