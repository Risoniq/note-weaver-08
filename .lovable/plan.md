

## Fix: Stuck "transcribing" Recordings reparierbar machen

### Problem
Das Recording haengt im Status "transcribing" fest. Die UI zeigt fuer diesen Status weder den "Transkript neu laden"-Button noch den "Aktualisieren"-Button an, weil:
- "Transkript neu laden" nur bei `status === 'done'` erscheint
- "Aktualisieren" nur bei `['pending', 'joining', 'recording', 'processing']` erscheint

Der Status "transcribing" faellt durch beide Bedingungen.

### Loesung

**Datei: `src/pages/MeetingDetail.tsx`**

1. Den Status `'transcribing'` zur Liste der aktualisierbaren Status hinzufuegen (Zeile 747), sodass der "Aktualisieren"-Button auch bei haengenden Transkriptionen erscheint
2. Alternativ (oder zusaetzlich): Den "Transkript neu laden"-Button auch fuer `'transcribing'` und `'error'` Status anzeigen, damit der User eine vollstaendige Neu-Synchronisation ausloesen kann

### Konkrete Aenderung

In Zeile 747 wird die Status-Liste erweitert:

```
// Vorher:
{['pending', 'joining', 'recording', 'processing'].includes(recording.status) && (

// Nachher:
{['pending', 'joining', 'recording', 'processing', 'transcribing'].includes(recording.status) && (
```

Zusaetzlich wird der "Transkript neu laden"-Button auch fuer fehlgeschlagene/haengende Status angezeigt:

```
// Vorher:
{recording.status === 'done' && (

// Nachher:
{['done', 'error', 'transcribing'].includes(recording.status) && (
```

Damit kann der User bei haengenden Transkriptionen sowohl schnell aktualisieren als auch eine vollstaendige Neu-Synchronisation ausloesen.

### Sofort-Fix fuer das aktuelle Recording

Nach dem Code-Update kann der User auf "Aktualisieren" oder "Transkript neu laden" klicken, was die sync-recording Edge Function aufruft und den korrekten Status von Recall.ai abruft.

