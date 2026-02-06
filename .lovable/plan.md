

## Ziel
Die Audio-Upload-Funktion wieder funktionsfähig machen. Aktuell schlägt das Hochladen fehl, weil die `transcribe-audio` Edge Function nicht deployed ist.

## Diagnose

| Check | Ergebnis |
|-------|----------|
| Edge Function Code | Vorhanden und korrekt (npm: imports, Deno.serve()) |
| Deployment Status | **Nicht deployed** (404 Not Found) |
| Logs | Keine - Anfragen kommen nie an |

## Lösung

Die Edge Function muss deployed werden. Der Code ist bereits korrekt und verwendet:
- `npm:@supabase/supabase-js@2` (moderner Import)
- `Deno.serve()` (modernes Runtime)
- Korrekte CORS-Headers

### Umsetzung

1. **Deployment ausführen**
   - Die `transcribe-audio` Funktion deployen

2. **Verifizierung**
   - Prüfen, dass die Funktion erreichbar ist (sollte 401 statt 404 zurückgeben)

3. **End-to-End Test**
   - Audio-Upload auf dem Dashboard testen

## Technische Details

| Datei | Status |
|-------|--------|
| `supabase/functions/transcribe-audio/index.ts` | Keine Änderung nötig - nur Deployment |

Die Funktion ist bereit und verwendet bereits die korrekte Architektur:

```text
transcribe-audio/
└── index.ts (npm: imports, Deno.serve())
```

## Akzeptanzkriterien

- Edge Function antwortet nicht mehr mit 404
- Audio-Upload startet die Transkription erfolgreich
- Fortschrittsbalken zeigt korrekten Status
- Transkription erscheint in der Recordings-Liste

