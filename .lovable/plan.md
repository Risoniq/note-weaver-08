

## Ziel
Den "Transkript neu laden" Button so anpassen, dass er für **manuelle Audio-Uploads** (`source: 'manual'`) die richtige Funktion aufruft (`analyze-transcript` statt `sync-recording`).

## Diagnose

| Status | Beschreibung |
|--------|-------------|
| ✅ | `sync-recording` ist jetzt deployed und funktioniert für Bot-Aufnahmen |
| ✅ | `analyze-transcript` ist deployed und hat die fehlende Analyse erfolgreich nachgeholt |
| ❌ | Frontend ruft immer `sync-recording` auf, auch für manuelle Uploads |
| ❌ | Manuelle Uploads haben keine Bot-ID, daher schlägt `sync-recording` fehl |

### Aktueller Ablauf bei "Neu laden" Button

```text
+----------------+     +-----------------+     +-------------------+
|  User klickt   |---->| syncRecording   |---->| sync-recording    |
|  "Neu laden"   |     | Status()        |     | Edge Function     |
+----------------+     +-----------------+     +-------------------+
                                                      |
                                                      v
                                            "No bot associated"
                                            (Fehler bei manuellen Uploads)
```

### Gewünschter Ablauf

```text
+----------------+     +-----------------+     
|  User klickt   |---->| syncRecording   |     
|  "Neu laden"   |     | Status()        |     
+----------------+     +-----------------+     
                              |
                    +---------+---------+
                    |                   |
                    v                   v
           source = 'manual'    source = 'bot'
                    |                   |
                    v                   v
          +-------------------+  +-------------------+
          | analyze-transcript|  | sync-recording    |
          | (Re-Analyse)      |  | (Recall.ai Sync)  |
          +-------------------+  +-------------------+
```

---

## Umsetzungsplan

### Schritt 1: syncRecordingStatus Funktion erweitern

**Datei:** `src/pages/MeetingDetail.tsx`

**Änderung:** In der `syncRecordingStatus` Callback-Funktion eine Unterscheidung nach `recording.source` einbauen:

1. Wenn `recording.source === 'manual'`:
   - Rufe `analyze-transcript` statt `sync-recording` auf
   - Zeige passende Toast-Meldung ("Analyse wird durchgeführt...")
   
2. Wenn `recording.source !== 'manual'` (Bot-Aufnahmen):
   - Behalte den bestehenden `sync-recording` Aufruf bei

### Schritt 2: Neuer Logik-Block für manuelle Uploads

Einfügen in `syncRecordingStatus` (Zeile 162-208):

```typescript
const syncRecordingStatus = useCallback(async (forceResync = false) => {
  if (!id || !recording) {
    return;
  }
  
  // Wenn nicht forced, nur bei nicht-fertigen Status synchronisieren
  if (!forceResync && (recording.status === 'done' || recording.status === 'error')) {
    return;
  }

  setIsSyncing(true);
  try {
    let data, error;
    
    // Für manuelle Uploads: analyze-transcript aufrufen
    if (recording.source === 'manual') {
      const result = await withTokenRefresh(
        () => supabase.functions.invoke('analyze-transcript', {
          body: { recording_id: id }
        })
      );
      data = result.data;
      error = result.error;
    } else {
      // Für Bot-Aufnahmen: sync-recording aufrufen
      const result = await withTokenRefresh(
        () => supabase.functions.invoke('sync-recording', {
          body: { id, force_resync: forceResync }
        })
      );
      data = result.data;
      error = result.error;
    }

    if (error) {
      console.error('Sync/Analysis error:', error);
      toast.error(recording.source === 'manual' 
        ? "Analyse fehlgeschlagen" 
        : "Synchronisierung fehlgeschlagen"
      );
      return;
    }

    // Refetch the recording to get updated data
    const updatedRecording = await fetchRecording();
    // ... Rest bleibt unverändert
  } catch (error) {
    // ...
  }
}, [id, recording, fetchRecording]);
```

### Schritt 3: Toast-Meldungen anpassen

Die Erfolgsmeldung sollte je nach Quelle unterschiedlich sein:

| Quelle | Toast bei Erfolg |
|--------|-----------------|
| `manual` | "Analyse wurde erfolgreich aktualisiert!" |
| Bot | "Transkript und Teilnehmernamen wurden aktualisiert!" |

---

## Technische Details

### Betroffene Dateien

| Datei | Änderung |
|-------|----------|
| `src/pages/MeetingDetail.tsx` | `syncRecordingStatus` Funktion anpassen |

### Geschätzter Umfang

- **~20 Zeilen** Code-Änderung in einer Funktion
- **Keine neuen Dependencies**
- **Keine Datenbank-Änderungen**

---

## Akzeptanzkriterien

- Bei manuellen Uploads zeigt der "Neu laden" Button keine Fehlermeldung mehr
- Key Points, To-Dos und Summary werden bei manuellen Uploads erfolgreich generiert/aktualisiert
- Bot-Aufnahmen funktionieren weiterhin wie bisher mit `sync-recording`
- Toast-Meldungen sind kontextabhängig (Analyse vs. Synchronisierung)

