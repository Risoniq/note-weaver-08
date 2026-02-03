
# Plan: Vollständige Titel-Persistenz und Synchronisierung

## Problem-Analyse

Die aktuelle Implementierung hat mehrere Lücken:

| Problem | Ort | Ursache |
|---------|-----|---------|
| Titel wird nicht dauerhaft angezeigt | MeetingDetail.tsx | Auto-Sync überschreibt lokalen State trotz Flag |
| Titel nicht im Transkript | transcript_text in DB | Keine Aktualisierung bei Titeländerung |
| Follow-Up E-Mail behält alten Titel | customEmail State | Wird nicht zurückgesetzt bei Titeländerung |
| Meeting-Übersicht zeigt alten Titel | RecordingCard.tsx | Realtime-Subscription aktualisiert, aber keine Cache-Invalidierung |

## Lösungsansatz

### 1. EditableTitle.tsx - Optimistisches Update + Callback-Timing

Das Hauptproblem: Der `onTitleChange` Callback wird erst nach dem DB-Update aufgerufen. Der lokale State in MeetingDetail wird erst dann aktualisiert. Zwischenzeitlich kann der Auto-Sync den alten Wert laden.

**Lösung:** 
- Callback **vor** dem DB-Update aufrufen (optimistisch)
- Bei Fehler: Rollback durch erneuten Callback mit altem Wert

### 2. MeetingDetail.tsx - Titel-Synchronisierung verbessern

```text
┌─────────────────────────────────────────────────────────┐
│ Nutzer ändert Titel                                      │
│   ↓                                                      │
│ onTitleChange wird SOFORT aufgerufen (optimistisch)     │
│   ↓                                                      │
│ titleJustUpdatedRef = true                              │
│   ↓                                                      │
│ setRecording mit neuem Titel                            │
│   ↓                                                      │
│ customEmail wird auf null gesetzt (E-Mail zurücksetzen) │
│   ↓                                                      │
│ Optional: Transkript-Header in DB aktualisieren         │
└─────────────────────────────────────────────────────────┘
```

**Änderungen:**
- `customEmail` bei Titeländerung auf `null` setzen → E-Mail wird neu generiert
- Flag-Timeout auf 10 Sekunden erhöhen (mehr Sicherheit)
- Transkript-Text in DB mit neuem Titel-Header aktualisieren

### 3. Transkript-Header in Datenbank schreiben

Der Titel wird als Header am Anfang des `transcript_text` eingefügt:

```
[Meeting: Neuer Titel]
---
Speaker 1: Hallo zusammen...
```

**Logik:**
- Prüfen ob bereits ein `[Meeting: ...]` Header existiert
- Falls ja: Header ersetzen
- Falls nein: Header am Anfang einfügen

### 4. RecordingDetailSheet.tsx - Callback hinzufügen

Die Sheet-Komponente hat keinen `onTitleChange` Callback für die `EditableTitle`. Dadurch wird der Parent-State nicht aktualisiert.

**Lösung:** Optional callback prop hinzufügen, der den Parent informiert

## Dateien und Änderungen

| Datei | Änderung |
|-------|----------|
| `src/components/recordings/EditableTitle.tsx` | Optimistisches Update: Callback VOR DB-Update |
| `src/pages/MeetingDetail.tsx` | 1. customEmail nullen bei Titeländerung 2. Transkript-Header in DB updaten 3. Flag-Timeout erhöhen |

## Technische Details

### EditableTitle.tsx

```typescript
// Bisheriger Flow:
// 1. DB Update
// 2. onTitleChange aufrufen

// Neuer Flow (optimistisch):
const handleSave = async () => {
  const trimmedTitle = editedTitle.trim();
  const oldTitle = title || '';
  
  if (trimmedTitle === oldTitle) {
    setIsEditing(false);
    return;
  }

  // SOFORT lokalen State aktualisieren (optimistisch)
  onTitleChange?.(trimmedTitle);
  setIsEditing(false);
  
  // Dann DB-Update im Hintergrund
  setIsSaving(true);
  const { error } = await supabase
    .from('recordings')
    .update({ title: trimmedTitle || null })
    .eq('id', recordingId);
  setIsSaving(false);

  if (error) {
    // Rollback bei Fehler
    onTitleChange?.(oldTitle);
    toast({ title: "Fehler", variant: "destructive" });
    return;
  }

  toast({ title: "Titel aktualisiert" });
};
```

### MeetingDetail.tsx - onTitleChange Handler

```typescript
onTitleChange={(newTitle) => {
  // 1. Flag setzen
  titleJustUpdatedRef.current = true;
  
  // 2. Lokalen State sofort aktualisieren
  setRecording(prev => prev ? { ...prev, title: newTitle } : null);
  
  // 3. customEmail zurücksetzen → Follow-Up wird neu generiert
  setCustomEmail(null);
  
  // 4. Transkript-Header in DB aktualisieren (async)
  if (recording?.transcript_text) {
    updateTranscriptHeader(newTitle, recording.id, recording.transcript_text);
  }
  
  // 5. Flag nach 10s zurücksetzen
  setTimeout(() => {
    titleJustUpdatedRef.current = false;
  }, 10000);
}}
```

### Neue Hilfsfunktion: updateTranscriptHeader

```typescript
const updateTranscriptHeader = async (
  newTitle: string, 
  recordingId: string, 
  currentTranscript: string
) => {
  // Header-Pattern: [Meeting: ...]---
  const headerPattern = /^\[Meeting:.*?\]\n---\n/;
  const newHeader = `[Meeting: ${newTitle}]\n---\n`;
  
  let updatedTranscript: string;
  if (headerPattern.test(currentTranscript)) {
    // Ersetze bestehenden Header
    updatedTranscript = currentTranscript.replace(headerPattern, newHeader);
  } else {
    // Füge neuen Header am Anfang ein
    updatedTranscript = newHeader + currentTranscript;
  }
  
  await supabase
    .from('recordings')
    .update({ transcript_text: updatedTranscript })
    .eq('id', recordingId);
};
```

## Erwartetes Ergebnis

Nach der Implementierung:

| Funktion | Verhalten |
|----------|-----------|
| Überschrift | Titel wird sofort und dauerhaft angezeigt |
| Transkript | Header mit aktuellem Titel wird in DB geschrieben |
| Follow-Up E-Mail | Wird automatisch neu generiert mit neuem Titel |
| Meeting-Übersicht | Realtime-Subscription zeigt neuen Titel |
| Seitenneulade | Zeigt korrekten Titel aus Datenbank |
