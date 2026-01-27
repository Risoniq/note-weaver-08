

# Teilnehmeranzahl-Bug: Meta-Daten werden als Sprecher gezaehlt

## Problem-Analyse

Das Transkript enthaelt am Anfang Meta-Daten im Format:

```text
[Meeting-Info]
User-ID: 704551d2-286b-4e57-80d0-721f198aea43
User-Email: dominik@risoniq.ai
Recording-ID: a7f0cdf9-b6ca-47f6-8f48-3992a318b979
Erstellt: 2026-01-27T11:01:24.170Z
---
```

Die `extractParticipants`-Funktion in `MeetingDetail.tsx` verwendet `/^([^:]+):/gm` um Sprecher zu erkennen. Dies erfasst faelschlicherweise auch die Meta-Zeilen:
- `User-ID`
- `User-Email`  
- `Recording-ID`
- `Erstellt`

Plus die 2 echten Sprecher (`Sforzin, Marco` und `Dominik Bauer`) = **6 "Teilnehmer"**

## Loesung

Es gibt zwei Ansaetze:

### Option A: Meta-Daten vor Extraktion entfernen (empfohlen)

Den Transkript-Block nach der `---` Trennlinie fuer die Sprecher-Extraktion verwenden:

```typescript
const extractParticipants = (transcript: string | null): string[] => {
  if (!transcript) return [];
  
  // Meta-Daten am Anfang entfernen (alles vor ---)
  const separatorIndex = transcript.indexOf('---');
  const cleanedTranscript = separatorIndex !== -1 
    ? transcript.substring(separatorIndex + 3) 
    : transcript;
  
  const speakerPattern = /^([^:]+):/gm;
  const matches = cleanedTranscript.match(speakerPattern);
  if (!matches) return [];
  const speakers = matches.map(m => m.replace(':', '').trim());
  return [...new Set(speakers)];
};
```

### Option B: Bekannte Meta-Felder filtern

Die extrahierten Namen gegen eine Blocklist pruefen:

```typescript
const META_FIELDS = ['User-ID', 'User-Email', 'Recording-ID', 'Erstellt', 'Meeting-Info'];

const speakers = matches
  .map(m => m.replace(':', '').trim())
  .filter(s => !META_FIELDS.includes(s));
```

## Empfehlung

**Option A** ist robuster, da sie alle zukuenftigen Meta-Felder automatisch ignoriert.

## Aenderung

**Datei:** `src/pages/MeetingDetail.tsx`

**Zeilen 471-479 aendern von:**
```typescript
const extractParticipants = (transcript: string | null): string[] => {
  if (!transcript) return [];
  const speakerPattern = /^([^:]+):/gm;
  const matches = transcript.match(speakerPattern);
  if (!matches) return [];
  const speakers = matches.map(m => m.replace(':', '').trim());
  return [...new Set(speakers)];
};
```

**Zu:**
```typescript
const extractParticipants = (transcript: string | null): string[] => {
  if (!transcript) return [];
  
  // Meta-Daten am Anfang entfernen (alles vor der --- Trennlinie)
  const separatorIndex = transcript.indexOf('---');
  const cleanedTranscript = separatorIndex !== -1 
    ? transcript.substring(separatorIndex + 3) 
    : transcript;
  
  const speakerPattern = /^([^:]+):/gm;
  const matches = cleanedTranscript.match(speakerPattern);
  if (!matches) return [];
  const speakers = matches.map(m => m.replace(':', '').trim());
  return [...new Set(speakers)];
};
```

## Ergebnis

Nach dieser Aenderung:
- Die Meta-Daten (`User-ID`, `User-Email`, etc.) werden nicht mehr als Sprecher gezaehlt
- Die Teilnehmeranzahl zeigt korrekt **2** fuer dieses Meeting (Sforzin, Marco und Dominik Bauer)
- Die bestehende Bot-Filterung bleibt weiterhin aktiv

## Betroffene Dateien

| Datei | Aenderung |
|-------|-----------|
| `src/pages/MeetingDetail.tsx` | `extractParticipants` Funktion erweitert um Meta-Daten zu ignorieren |

