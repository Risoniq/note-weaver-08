
# Meeting-Kontingent mit tatsächlicher Dauer verbinden

## Problem-Analyse

Die Meeting-Kontingent-Leiste zeigt aktuell immer "0m" an, weil die `duration`-Spalte in der `recordings`-Tabelle für alle Einträge `NULL` ist:

| Recording | duration |
|-----------|----------|
| Produkt-Update & Roadmap Diskussion | NULL |
| Vertriebstraining und -strategie | NULL |
| KI-Bot für Leadgenerierung | NULL |
| ... | NULL |

Die Duration-Daten sind jedoch verfügbar! Recall.ai liefert `started_at` und `completed_at` im Recording-Objekt:

```json
{
  "started_at": "2026-01-21T18:35:57.672768Z",
  "completed_at": "2026-01-21T19:42:27.506161Z"
}
```

Die `sync-recording` Edge Function berechnet diese Differenz nicht und speichert sie nicht in der Datenbank.

---

## Lösungsansatz

### 1. sync-recording Edge Function erweitern

Die Funktion muss die Meeting-Dauer aus `started_at` und `completed_at` berechnen und als Sekunden in der `duration`-Spalte speichern.

**Datei: `supabase/functions/sync-recording/index.ts`**

Nach dem Abrufen der Bot-Daten von Recall.ai:

```typescript
// Duration aus recordings[0] berechnen
if (botData.recordings?.[0]) {
  const recording = botData.recordings[0];
  const startedAt = recording.started_at;
  const completedAt = recording.completed_at;
  
  if (startedAt && completedAt) {
    const startTime = new Date(startedAt).getTime();
    const endTime = new Date(completedAt).getTime();
    const durationSeconds = Math.round((endTime - startTime) / 1000);
    
    if (durationSeconds > 0) {
      updates.duration = durationSeconds;
      console.log(`Meeting-Dauer berechnet: ${durationSeconds}s (${Math.round(durationSeconds/60)}min)`);
    }
  }
}
```

### 2. Bestehende Recordings reparieren

Eine einmalige Reparatur-Funktion, die für alle bestehenden "done"-Recordings die Duration nachträglich berechnet. Dies kann über die existierende `repair-all-recordings` Edge Function erfolgen.

**Optionen:**
- Button in Settings zum "Reparieren aller Recordings"  
- Oder automatisches Re-Sync wenn ein User seine Recordings öffnet

### 3. useUserQuota Hook (bereits korrekt implementiert)

Der Hook summiert bereits die `duration` aller Recordings mit Status "done":

```typescript
const usedSeconds = recordings?.reduce((sum, r) => sum + (r.duration || 0), 0) || 0;
const usedMinutes = Math.round(usedSeconds / 60);
```

Sobald die Duration-Werte in der DB stehen, funktioniert die Berechnung automatisch.

### 4. QuotaProgressBar (bereits korrekt implementiert)

Die Komponente zeigt bereits die Werte aus `useUserQuota` an und berechnet Farben basierend auf dem Verbrauch.

---

## Technische Umsetzung

| Datei | Änderung |
|-------|----------|
| `supabase/functions/sync-recording/index.ts` | Duration aus `started_at`/`completed_at` berechnen und in `updates.duration` speichern |
| `supabase/functions/repair-all-recordings/index.ts` | Prüfen/erweitern, dass Duration bei Re-Sync korrekt gesetzt wird |
| (Optional) `src/pages/Settings.tsx` | Button "Kontingent aktualisieren" zum manuellen Re-Sync aller Recordings |

---

## Ablauf nach Implementierung

```text
Neues Meeting endet
       ↓
sync-recording wird aufgerufen
       ↓
Duration wird aus started_at/completed_at berechnet
       ↓
Duration (in Sekunden) wird in recordings.duration gespeichert
       ↓
useUserQuota summiert alle done-Recordings
       ↓
QuotaProgressBar zeigt: "1h 6m / 50h" (beispiel)
```

---

## Erwartetes Ergebnis

- Bei jedem abgeschlossenen Meeting wird die tatsächliche Dauer in Sekunden gespeichert
- Die Kontingent-Leiste auf dem Dashboard zeigt die korrekte Summe aller Meeting-Dauern
- Die Warnung bei 80%/100% Verbrauch funktioniert korrekt
- Admins können über das Admin-Dashboard die Kontingente pro User einsehen und anpassen
- Bestehende Meetings können über "Transkript neu laden" oder eine Reparatur-Funktion aktualisiert werden
