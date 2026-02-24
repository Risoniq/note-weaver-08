
# Analyse-Fehler beheben: Recording 1ca33b84 (Meeting vom 24.02.)

## Diagnose

Das Meeting (`1ca33b84-c981-4193-bf6c-25952beda8a5`) hat zwar ein vollstaendiges Transkript (40.347 Zeichen), aber **keine Analyse** (Summary, Key Points, Action Items und Titel fehlen).

**Ursache**: Die KI-API hat beim Sync zweimal mit **HTTP 402 (Payment Required)** geantwortet - die AI-Credits waren zu dem Zeitpunkt aufgebraucht. Die Fehlermeldung war: "Service unavailable. Please contact support."

Dies ist **kein permanenter Code-Bug**, sondern ein temporaerer Credit-Engpass. Allerdings gibt es eine **systemische Luecke**: Wenn die Analyse beim initialen Sync fehlschlaegt, gibt es keinen automatischen Retry-Mechanismus.

## Loesung (2 Teile)

### Teil 1: Sofortiger Retry fuer dieses Meeting

Die Analyse fuer Recording `1ca33b84-c981-4193-bf6c-25952beda8a5` erneut ausloesen. Da der "Transkript neu laden"-Button in der UI bereits existiert, kann dies auch manuell erfolgen - aber ich werde einen automatischen Retry einbauen.

### Teil 2: Retry-Logik in sync-recording einbauen (permanenter Fix)

**Datei: `supabase/functions/sync-recording/index.ts`** (Zeilen 942-960)

Wenn die Analyse mit einem temporaeren Fehler (402, 429, 500+) fehlschlaegt:
- 1. Versuch sofort
- Bei Fehler: 10 Sekunden warten, dann 2. Versuch
- Bei erneutem Fehler: Log-Warnung, aber kein Abbruch des gesamten Sync-Prozesses

```text
Aktueller Ablauf:
  sync-recording -> analyze-transcript -> 402 Fehler -> Fertig (keine Analyse)

Neuer Ablauf:
  sync-recording -> analyze-transcript -> 402 Fehler
                 -> 10s warten
                 -> analyze-transcript (Retry) -> Erfolg oder Log-Warnung
```

### Aenderungen im Detail

| Datei | Aenderung |
|---|---|
| `supabase/functions/sync-recording/index.ts` | Retry-Logik mit 1 Wiederholungsversuch und 10s Wartezeit bei temporaeren Fehlern (402, 429, 5xx) |

### Technische Details

In `sync-recording/index.ts` wird der Analyse-Aufruf (Zeilen 944-960) erweitert:

```text
// Vorher: Einmaliger Versuch
const analyzeResponse = await fetch(...)
if (!analyzeResponse.ok) {
  console.error('Analyse-Start fehlgeschlagen:', ...)
}

// Nachher: Retry bei temporaeren Fehlern
const maxRetries = 2;
for (let attempt = 1; attempt <= maxRetries; attempt++) {
  const analyzeResponse = await fetch(...)
  if (analyzeResponse.ok) {
    console.log('Analyse erfolgreich gestartet')
    break;
  }
  const errorText = await analyzeResponse.text();
  const isRetryable = [402, 429, 500, 502, 503].includes(analyzeResponse.status);
  if (isRetryable && attempt < maxRetries) {
    console.warn(`Analyse Versuch ${attempt} fehlgeschlagen (${analyzeResponse.status}), Retry in 10s...`)
    await new Promise(r => setTimeout(r, 10000));
  } else {
    console.error(`Analyse endgueltig fehlgeschlagen nach ${attempt} Versuchen:`, errorText)
  }
}
```

Nach dem Deploy wird ausserdem ein manueller Resync fuer das betroffene Recording ausgeloest, um die Analyse nachzuholen.
