
## Ziel
Alle Kalender-bezogenen Edge Functions reparieren und deployen, damit die Kalender-Integration vollständig funktioniert.

## Diagnose

### Aktuelle Situation

| Edge Function | Status | Problem |
|---------------|--------|---------|
| `google-recall-auth` | **Funktioniert** | - |
| `microsoft-recall-auth` | **Funktioniert** | - |
| `google-calendar-auth` | **404 Not Found** | Veraltete Imports |
| `google-calendar-events` | **404 Not Found** | Veraltete Imports |
| `recall-calendar-auth` | **404 Not Found** | Veraltete Imports |
| `recall-calendar-meetings` | **404 Not Found** | Veraltete Imports |

### Ursache
Die 4 nicht funktionierenden Funktionen verwenden noch veraltete Import-URLs:
- `import { serve } from "https://deno.land/std@0.168.0/http/server.ts"`
- `import { createClient } from "https://esm.sh/@supabase/supabase-js@2"`

Diese führen zu Deployment-Timeouts oder -Fehlern.

---

## Umsetzungsplan

### Schritt 1: google-calendar-auth migrieren

**Datei:** `supabase/functions/google-calendar-auth/index.ts`

Änderungen:
- Import von `serve()` entfernen
- `createClient` auf `npm:@supabase/supabase-js@2` umstellen
- `serve()` durch `Deno.serve()` ersetzen

### Schritt 2: google-calendar-events migrieren

**Datei:** `supabase/functions/google-calendar-events/index.ts`

Änderungen:
- Import von `serve()` entfernen
- `serve()` durch `Deno.serve()` ersetzen
- Kein Supabase-Import benötigt (diese Funktion ruft nur die Google API auf)

### Schritt 3: recall-calendar-auth migrieren

**Datei:** `supabase/functions/recall-calendar-auth/index.ts`

Änderungen:
- Import von `serve()` entfernen
- `createClient` auf `npm:@supabase/supabase-js@2` umstellen
- `serve()` durch `Deno.serve()` ersetzen

### Schritt 4: recall-calendar-meetings migrieren

**Datei:** `supabase/functions/recall-calendar-meetings/index.ts`

Änderungen:
- Import von `serve()` entfernen
- `createClient` auf `npm:@supabase/supabase-js@2` umstellen
- `serve()` durch `Deno.serve()` ersetzen

### Schritt 5: Alle 4 Funktionen deployen

Nach der Code-Aktualisierung alle 4 Funktionen gezielt deployen:
- `google-calendar-auth`
- `google-calendar-events`
- `recall-calendar-auth`
- `recall-calendar-meetings`

### Schritt 6: Deployment verifizieren

Per Test-Aufruf prüfen, dass alle Funktionen erreichbar sind (sollten 400/401 statt 404 zurückgeben).

---

## Technische Details

### Code-Änderungen pro Datei

```typescript
// ALT (in allen 4 Dateien):
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  // ...
});

// NEU:
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  // ... (Rest bleibt identisch)
});
```

### Betroffene Dateien

| Datei | Zeilen | Änderungstyp |
|-------|--------|--------------|
| `supabase/functions/google-calendar-auth/index.ts` | 1-2, 52 | Import-Migration |
| `supabase/functions/google-calendar-events/index.ts` | 1, 28 | Import-Migration |
| `supabase/functions/recall-calendar-auth/index.ts` | 1-2, 49 | Import-Migration |
| `supabase/functions/recall-calendar-meetings/index.ts` | 1-2, 53 | Import-Migration |

---

## Akzeptanzkriterien

- Alle 4 Funktionen antworten nicht mehr mit 404
- Kalender-Verbindung kann gestartet werden (OAuth-Popup öffnet sich)
- Kalender-Events werden korrekt synchronisiert
- Meeting-Liste wird auf dem Dashboard angezeigt
