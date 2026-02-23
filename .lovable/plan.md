

# M1: Quota-Check vor Aufnahme & M3: Audio-Chunks Speicherlimit

## Uebersicht

Zwei mittlere Risiken werden behoben:

1. **M1**: Vor dem Start einer Aufnahme wird geprueft, ob das Kontingent erschoepft ist. Falls ja, wird die Aufnahme blockiert und das QuotaExhaustedModal angezeigt.
2. **M3**: Audio-Chunks werden waehrend der Aufnahme in der Groesse ueberwacht. Bei Ueberschreitung eines Limits (500 MB) wird die Aufnahme automatisch gestoppt, um einen Browser-Absturz zu verhindern.

---

## Aenderungen

### 1. `src/hooks/useQuickRecording.ts` -- Quota-Check + Chunk-Limit

**M1 -- Quota-Check:**
- Neuen Parameter `onQuotaExhausted?: () => void` als Callback akzeptieren
- Vor `startRecording`: Quota aus der Datenbank laden (gleiche Logik wie `useUserQuota`, aber als einmalige Abfrage)
- Falls `is_exhausted === true`: Callback aufrufen, Aufnahme nicht starten

**M3 -- Chunk-Speicherlimit:**
- Neuen Ref `totalChunkSizeRef` einfuehren, der die kumulative Groesse aller Chunks zaehlt
- In `ondataavailable`: Groesse addieren und gegen Limit (500 MB) pruefen
- Bei Ueberschreitung: `stopRecording()` aufrufen und Warnung anzeigen
- Beim Start: `totalChunkSizeRef` zuruecksetzen

### 2. `src/components/layout/AppLayout.tsx` -- QuotaExhaustedModal einbinden

- State `showQuotaModal` einfuehren
- `onQuotaExhausted` Callback an `useQuickRecording` uebergeben, der das Modal oeffnet
- `QuotaExhaustedModal` im Layout rendern

### 3. `src/components/MeetingNoteTaker.tsx` -- Quota-Check + Chunk-Limit

**M1 -- Quota-Check:**
- `useUserQuota` Hook verwenden (bereits vorhanden)
- In `startRecording`: Vor der Medien-Anfrage pruefen ob `quota?.is_exhausted`
- Falls ja: Fehler setzen und QuotaExhaustedModal anzeigen

**M3 -- Chunk-Speicherlimit:**
- Gleiche Logik wie in `useQuickRecording`: `totalChunkSizeRef` einfuehren
- In `ondataavailable`: Groesse pruefen, bei 500 MB auto-stop
- Toast mit Warnung: "Aufnahme wurde automatisch beendet -- Speicherlimit erreicht (500 MB). Bitte speichere kuerzere Aufnahmen."

---

## Technische Details

### Quota-Check in useQuickRecording (einmalige Abfrage)

Da `useQuickRecording` keinen `useUserQuota`-Hook intern verwenden sollte (wuerde bei jedem Render laufen), wird stattdessen eine einmalige Abfrage beim Klick auf "Start" gemacht:

```text
startRecording:
  1. Lade user via supabase.auth.getUser()
  2. Lade team_members + teams ODER user_quotas
  3. Berechne used_minutes vs max_minutes
  4. Falls erschoepft: onQuotaExhausted() aufrufen, return
  5. Sonst: normal weiter mit Aufnahme
```

Alternativ einfacher: `useUserQuota` wird direkt im AppLayout aufgerufen und das Ergebnis als Parameter an `useQuickRecording` uebergeben (vermeidet doppelten DB-Code).

Gewaehlt: Die einfachere Variante -- `useUserQuota` im AppLayout, Quota-State als Check vor dem Start.

### Chunk-Groessen-Tracking

```text
const MAX_CHUNK_BYTES = 500 * 1024 * 1024; // 500 MB
const totalChunkSizeRef = useRef(0);

ondataavailable = (e) => {
  totalChunkSizeRef.current += e.data.size;
  chunks.push(e.data);
  if (totalChunkSizeRef.current >= MAX_CHUNK_BYTES) {
    stopRecording();
    toast({ title: "Speicherlimit erreicht", ... });
  }
};
```

---

## Was sich NICHT aendert

- Datenbank-Schema (keine neuen Tabellen/Spalten)
- Edge Functions
- QuotaExhaustedModal-Komponente (wird unveraendert wiederverwendet)
- QuotaProgressBar (unveraendert)
- useUserQuota Hook (unveraendert)

