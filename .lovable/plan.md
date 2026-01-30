
# Plan: CORS-Fehler in Kalender Edge Functions beheben

## Problem-Analyse

Die Fehlermeldung "Failed to send a request to the Edge Function" für beide Kalender (Google und Microsoft) wird durch **unvollständige CORS-Header** in drei Edge Functions verursacht:

1. `google-recall-auth/index.ts`
2. `microsoft-recall-auth/index.ts` 
3. `recall-calendar-meetings/index.ts`

### Zwei Hauptprobleme:

**Problem 1: Fehlende Supabase-Client-Header**
Die Header-Liste ist unvollständig und blockiert Browser-Anfragen:
```text
Aktuell:    authorization, x-client-info, apikey, content-type
Erforderlich: authorization, x-client-info, apikey, content-type, 
              x-supabase-client-platform, x-supabase-client-platform-version, 
              x-supabase-client-runtime, x-supabase-client-runtime-version
```

**Problem 2: Custom Domain wird nicht erkannt**
Die Domain `notetaker2pro.com` wird von der Origin-Prüfung nicht akzeptiert. Nur `.lovableproject.com` und `.lovable.app` werden automatisch erkannt.

---

## Lösung

### Schritt 1: CORS-Funktion in allen drei Edge Functions aktualisieren

Die `getCorsHeaders`-Funktion wird in allen drei Dateien durch eine standardkonforme Version ersetzt:

```text
supabase/functions/google-recall-auth/index.ts (Zeile 4-24)
supabase/functions/microsoft-recall-auth/index.ts (Zeile 4-24)
supabase/functions/recall-calendar-meetings/index.ts (Zeile 4-25)
```

### Neue CORS-Funktion:

```typescript
function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const allowedOrigins = [
    Deno.env.get('APP_URL') || '',
    'https://notetaker2pro.com',
    'https://www.notetaker2pro.com',
    'http://localhost:5173',
    'http://localhost:8080',
    'http://localhost:3000',
  ].filter(Boolean);
  
  const isLovablePreview = origin.endsWith('.lovableproject.com') || origin.endsWith('.lovable.app');
  const allowOrigin = allowedOrigins.includes(origin) || isLovablePreview 
    ? origin 
    : '*';
  
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
    'Access-Control-Allow-Credentials': 'true',
  };
}
```

### Änderungen im Detail:

| Änderung | Grund |
|----------|-------|
| `notetaker2pro.com` hinzugefügt | Custom Domain explizit erlauben |
| Header-Liste erweitert | Supabase JS Client sendet diese Header |
| Fallback auf `*` statt erste Origin | Verhindert Fehler bei unbekannten Origins |

---

## Betroffene Dateien

| Datei | Zeilen | Änderung |
|-------|--------|----------|
| `supabase/functions/google-recall-auth/index.ts` | 4-24 | CORS-Funktion aktualisieren |
| `supabase/functions/microsoft-recall-auth/index.ts` | 4-24 | CORS-Funktion aktualisieren |
| `supabase/functions/recall-calendar-meetings/index.ts` | 4-25 | CORS-Funktion aktualisieren |

---

## Nach der Änderung

Die Edge Functions werden automatisch deployed. Danach:

1. Lade die Seite auf `notetaker2pro.com` neu
2. Versuche erneut, Google oder Microsoft Kalender zu verbinden
3. Die CORS-Fehler sollten behoben sein

---

## Technische Details

Die Supabase JS Client Bibliothek (Version 2.87.1) sendet folgende Header bei jedem Request:
- `x-supabase-client-platform`: Browser-Plattform
- `x-supabase-client-platform-version`: Version
- `x-supabase-client-runtime`: Runtime-Info
- `x-supabase-client-runtime-version`: Runtime-Version

Wenn diese Header nicht in `Access-Control-Allow-Headers` aufgeführt sind, blockiert der Browser den Request mit einem CORS-Fehler.
