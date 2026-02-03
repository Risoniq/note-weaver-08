

# Plan: CORS-Konfiguration für alle Edge Functions vereinheitlichen

## Problem identifiziert

Die Nutzer sehen "Synchronisierung fehlgeschlagen" auf der Production-URL `notetaker2pro.com`, weil die CORS-Konfiguration in mehreren Edge Functions inkonsistent ist.

### Aktueller Zustand

| Edge Function | notetaker2pro.com | Lovable Preview | Status |
|--------------|-------------------|-----------------|--------|
| sync-recording | **FEHLT** | ✓ | **BLOCKIERT** |
| analyze-transcript | **FEHLT** | ✓ | **BLOCKIERT** |
| meeting-bot-webhook | **FEHLT** | ✓ | **BLOCKIERT** |
| repair-all-recordings | **FEHLT** | ✓ | **BLOCKIERT** |
| create-bot | ✓ | ✓ | OK |
| admin-view-user-data | ✓ | ✓ | OK |
| google-recall-auth | ✓ | ✓ | OK |
| microsoft-recall-auth | ✓ | ✓ | OK |

Die betroffenen Functions nutzen eine dynamische CORS-Konfiguration, aber ohne die Production-Domain `notetaker2pro.com`.

## Lösung

Die CORS-Konfiguration in allen betroffenen Edge Functions auf ein einheitliches Schema aktualisieren:

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
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
  };
}
```

## Betroffene Dateien

| Datei | Änderung |
|-------|----------|
| `supabase/functions/sync-recording/index.ts` | `notetaker2pro.com` hinzufügen |
| `supabase/functions/analyze-transcript/index.ts` | `notetaker2pro.com` hinzufügen |
| `supabase/functions/meeting-bot-webhook/index.ts` | `notetaker2pro.com` hinzufügen |
| `supabase/functions/repair-all-recordings/index.ts` | `notetaker2pro.com` hinzufügen |
| `supabase/functions/google-calendar-events/index.ts` | `notetaker2pro.com` hinzufügen |

## Technische Details

### Warum tritt das Problem auf?

Der Browser sendet bei Cross-Origin-Requests (z.B. von `notetaker2pro.com` zu `supabase.co`) einen Preflight-Request (OPTIONS). Die Antwort muss den korrekten `Access-Control-Allow-Origin`-Header enthalten.

Aktuell:
1. Request kommt von `https://notetaker2pro.com`
2. `sync-recording` prüft: Ist `notetaker2pro.com` in `allowedOrigins`? **NEIN**
3. Ist es eine Lovable-Preview-Domain (`.lovable.app`)? **NEIN** 
4. Fallback: Erstes Element aus `allowedOrigins` oder `*`
5. Wenn `APP_URL` nicht gesetzt ist, wird nur `localhost` zurückgegeben
6. Browser blockiert Request wegen Origin-Mismatch

### Warum funktioniert es für Admins?

Admins nutzen möglicherweise die Lovable-Preview-URL (`*.lovable.app`), die bereits unterstützt wird, oder haben `APP_URL` korrekt konfiguriert.

## Ergebnis nach der Änderung

- Alle Nutzer können Transkripte auf beiden URLs synchronisieren
- CORS-Fehler auf `notetaker2pro.com` werden behoben
- Konsistente Konfiguration über alle Edge Functions
- Backward-kompatibel mit localhost und Lovable-Preview

