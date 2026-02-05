
## Audio-Upload als eigenständiges Meeting kennzeichnen

### Status Quo
Die aktuelle Implementierung ist bereits größtenteils korrekt:
- Die Edge Function `transcribe-audio` setzt `source: 'manual'` beim Erstellen des Recordings
- Es wird **kein Bot** gestartet - die Datei wird direkt zu ElevenLabs geschickt und transkribiert
- Die AI-Analyse wird automatisch nach der Transkription ausgelöst

### Was fehlt
Das `source`-Feld wird in der UI nicht angezeigt. Uploads sind nicht visuell von Bot-Meetings unterscheidbar.

---

## Änderungen

### 1. Recording-Type erweitern
**Datei:** `src/types/recording.ts`

Das `source`-Feld zum Interface hinzufügen:
```typescript
export interface Recording {
  // ... bestehende Felder ...
  source: 'bot' | 'desktop_sdk' | 'manual' | null;
}
```

### 2. RecordingCard mit Upload-Icon versehen
**Datei:** `src/components/recordings/RecordingCard.tsx`

Ein Upload-Icon (📤 oder `Upload` von Lucide) neben dem Titel anzeigen, wenn `source === 'manual'`:

```typescript
import { Upload } from 'lucide-react';

// Im Header-Bereich:
{recording.source === 'manual' && (
  <Upload className="h-4 w-4 text-muted-foreground shrink-0" title="Hochgeladene Datei" />
)}
```

### 3. Status "transcribing" hinzufügen
**Datei:** `src/types/recording.ts`

Den neuen Status für manuelle Uploads in die Labels aufnehmen:
```typescript
transcribing: 'Transkribiert...',
```

---

## Technische Details

| Komponente | Änderung |
|------------|----------|
| `Recording` Interface | + `source` Feld |
| `RecordingCard` | + Upload-Icon bei `source === 'manual'` |
| `getStatusLabel` | + Label für `transcribing` Status |
| `getStatusColor` | + Farbe für `transcribing` Status |

## Visuelles Ergebnis
Hochgeladene Audio-Meetings zeigen ein 📤-Symbol neben dem Titel, sodass Benutzer sofort erkennen, dass es sich um eine manuell hochgeladene Datei handelt (im Gegensatz zu Bot-Aufnahmen).
