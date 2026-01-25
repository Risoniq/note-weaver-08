
# Sprechererkennung im Transkript korrigieren

## Problem-Analyse

Die Edge Function `sync-recording` extrahiert Sprechernamen falsch. Die Logs zeigen:

**Was die API liefert:**
```json
{
  "participant": {
    "id": 200,
    "name": "Dominik Bauer",
    "platform": "desktop",
    "is_host": false
  },
  "words": [...]
}
```

**Was der Code sucht:**
```typescript
entry.user?.name   // undefined!
entry.speaker_id   // undefined!
```

Der Code sucht nach `entry.user.name`, aber Recall.ai liefert `entry.participant.name`. Das erklärt, warum alle Sprecher als "Sprecher 1" erscheinen.

## Lösung

### 1. sync-recording Edge Function korrigieren

Die `getBestSpeakerName`-Funktion muss `entry.participant` statt `entry.user` lesen:

**Datei: `supabase/functions/sync-recording/index.ts`**

| Änderung | Alt | Neu |
|----------|-----|-----|
| Participant-Feld | `entry.user` | `entry.participant` |
| Name-Priorität 1 | `entry.user?.name` | `entry.participant?.name` |
| ID-Lookup | `entry.user?.id` | `entry.participant?.id` |
| Platform-ID | `entry.user?.platform_user_id` | `entry.participant?.platform_user_id` |

```typescript
// VORHER (falsch)
const getBestSpeakerName = (entry: { 
  speaker?: string; 
  speaker_id?: number; 
  user?: { id?: number; name?: string; ... };
}): string => {
  if (entry.user?.name) { ... }
}

// NACHHER (korrekt)
const getBestSpeakerName = (entry: { 
  speaker?: string; 
  speaker_id?: number; 
  participant?: { id?: number; name?: string; ... };
  user?: { id?: number; name?: string; ... }; // Fallback
}): string => {
  // Priorität 1: participant.name (Recall.ai aktuelles Format)
  if (entry.participant?.name) { ... }
  // Fallback: user.name (altes Format)
  if (entry.user?.name) { ... }
}
```

### 2. Teilnehmer-Extraktion verbessern

Beim Formatieren des Transkripts auch die `participantsList` korrekt befüllen:

```typescript
// Nach dem Transkript-Parsing: Alle eindeutigen Sprecher sammeln
const uniqueParticipants = new Map<string, { id: string; name: string }>();
transcriptData.forEach(entry => {
  if (entry.participant?.name) {
    const id = String(entry.participant.id || '');
    // Notetaker-Bots ausschließen
    const name = entry.participant.name;
    if (!name.toLowerCase().includes('notetaker') && 
        !name.toLowerCase().includes('bot')) {
      uniqueParticipants.set(id, { id, name });
    }
  }
});
participantsList = Array.from(uniqueParticipants.values());
```

### 3. Frontend: Teilnehmeranzahl korrekt zählen

**Datei: `src/pages/MeetingDetail.tsx`**

Verbessere die `extractParticipants`-Funktion und Zähllogik:

```typescript
const extractParticipants = (transcript: string | null): string[] => {
  if (!transcript) return [];
  const speakerPattern = /^([^:]+):/gm;
  const matches = transcript.match(speakerPattern);
  if (!matches) return [];
  const speakers = matches.map(m => m.replace(':', '').trim());
  // Unique Sprecher ohne Bots
  const unique = [...new Set(speakers)].filter(s => 
    !s.toLowerCase().includes('notetaker') && 
    !s.toLowerCase().includes('bot')
  );
  return unique;
};

// Teilnehmeranzahl: Zähle unique Sprecher (ohne generische Fallbacks)
const nonGenericSpeakers = transcriptParticipants.filter(s => 
  s !== 'Unbekannt' && 
  !s.startsWith('Sprecher ') &&
  !s.toLowerCase().includes('notetaker')
);
```

### 4. Notetaker aus Zählung ausschließen

Sowohl Backend als auch Frontend sollen Bots/Notetaker ignorieren:

```typescript
// Pattern für Bot-Erkennung
const isBot = (name: string): boolean => {
  const botPatterns = ['notetaker', 'bot', 'recording', 'assistant'];
  return botPatterns.some(p => name.toLowerCase().includes(p));
};
```

---

## Erwartetes Ergebnis

Nach der Korrektur:

1. **Transkript zeigt echte Namen**: "Dominik Bauer: ..." statt "Sprecher 1: ..."
2. **Teilnehmeranzahl korrekt**: Zählt alle einzigartigen Sprecher (ohne Bots)
3. **`participants`-Feld in DB gefüllt**: Enthält ID und Name jedes Sprechers
4. **Re-Sync repariert bestehende Meetings**: Button "Transkript neu laden" aktualisiert mit korrekten Namen

## Betroffene Dateien

| Datei | Änderung |
|-------|----------|
| `supabase/functions/sync-recording/index.ts` | `participant` statt `user`, Bot-Filter |
| `src/pages/MeetingDetail.tsx` | Verbesserte Teilnehmerzählung, Bot-Filter |
