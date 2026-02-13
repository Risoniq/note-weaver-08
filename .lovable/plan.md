

## Teilnehmernamen in der Aufnahmen-Übersicht anzeigen

### Aktueller Zustand
Die RecordingCard zeigt nur die Anzahl der Teilnehmer ("3 Teilnehmer"), aber nicht deren Namen.

### Aenderung in `src/components/recordings/RecordingCard.tsx`

1. **Import hinzufuegen**: `getConsistentParticipantCount` aus `@/utils/participantUtils`
2. **Teilnehmer-Logik ersetzen**: Statt `recording.participants?.length` wird `getConsistentParticipantCount(recording)` verwendet, um sowohl Anzahl als auch Namen zu erhalten
3. **Namen anzeigen**: Nach der Teilnehmer-Anzahl die Namen als kommaseparierte Liste anzeigen (z.B. "3 Teilnehmer: Max Müller, Anna Schmidt, Tom Braun")
4. Namen werden mit `line-clamp-1` abgeschnitten falls zu lang

### Konkrete Aenderung

Zeile 32 ersetzen:
```tsx
// Alt:
const participantCount = recording.participants?.length ?? 0;

// Neu:
const participantResult = getConsistentParticipantCount(recording);
const participantCount = participantResult.count;
const participantNames = participantResult.names;
```

Zeilen 104-109 ersetzen:
```tsx
// Alt: nur Anzahl
{participantCount > 0 && (
  <div className="flex items-center gap-1.5">
    <UsersIcon className="h-3.5 w-3.5" />
    <span>{participantCount} Teilnehmer</span>
  </div>
)}

// Neu: Anzahl + Namen
{participantCount > 0 && (
  <div className="flex items-center gap-1.5">
    <UsersIcon className="h-3.5 w-3.5" />
    <span className="truncate max-w-[400px]">
      {participantNames.length > 0
        ? participantNames.join(', ')
        : `${participantCount} Teilnehmer`}
    </span>
  </div>
)}
```

### Betroffene Datei
- `src/components/recordings/RecordingCard.tsx`

