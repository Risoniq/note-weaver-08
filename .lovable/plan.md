
# Kalender-Titel in Aufnahmen übernehmen und Titel bearbeitbar machen

## Analyse des aktuellen Zustands

**Datenbankprüfung zeigt:**
- Viele fertige Recordings haben bereits beschreibende Titel (von AI generiert)
- Einige Recordings mit Status `joining` haben keinen Titel (`NULL`)
- Kalender-Meeting-Titel werden nicht automatisch übernommen

**Aktueller Datenfluss:**
```text
┌──────────────────┐    ┌─────────────────┐    ┌──────────────────────┐
│ Kalender-Meeting │    │   create-bot    │    │ Recording erstellt   │
│ (mit Titel)      │───▶│ (ohne Titel)    │───▶│ title = NULL         │
└──────────────────┘    └─────────────────┘    └──────────────────────┘
                                                         │
                        ┌────────────────────────────────┘
                        ▼
              ┌─────────────────────┐    ┌────────────────────────┐
              │   sync-recording    │───▶│   analyze-transcript   │
              │ (holt Bot-Daten)    │    │ (generiert Titel wenn  │
              └─────────────────────┘    │  keiner existiert)     │
                                         └────────────────────────┘
```

## Geplante Änderungen

### 1. Kalender-Titel bei Bot-Erstellung übernehmen

**Datei: `supabase/functions/create-bot/index.ts`**

Wenn ein Bot manuell über die Quick-Join-Funktion erstellt wird, gibt es keinen Kalender-Titel. Aber in `sync-recording` können wir den Kalender-Titel nachträglich abrufen.

**Datei: `supabase/functions/sync-recording/index.ts`** (Zeile ~190-220)

Beim Abrufen der Kalender-Teilnehmer wird bereits das Calendar-Meeting abgerufen. Hier den Meeting-Titel extrahieren und speichern:

```typescript
// Bestehender Code bei Zeile 204-219
if (meetings.length > 0) {
  const calendarMeeting = meetings[0]
  
  // NEU: Meeting-Titel aus Kalender übernehmen (falls Recording noch keinen hat)
  if (!recording.title && calendarMeeting.title) {
    updates.title = calendarMeeting.title
    console.log('Kalender-Titel übernommen:', calendarMeeting.title)
  }
  
  // Bestehende Teilnehmer-Logik...
  const attendees = calendarMeeting.meeting_attendees || calendarMeeting.attendees || []
  // ...
}
```

### 2. Titel in RecordingDetailSheet bearbeitbar machen

**Datei: `src/components/recordings/RecordingDetailSheet.tsx`**

Titel-Feld durch ein bearbeitbares Feld ersetzen:

```typescript
// State für Titel-Bearbeitung
const [isEditingTitle, setIsEditingTitle] = useState(false);
const [editedTitle, setEditedTitle] = useState(recording.title || '');

// Update-Funktion
const handleTitleSave = async () => {
  if (editedTitle.trim() === recording.title) {
    setIsEditingTitle(false);
    return;
  }
  
  const { error } = await supabase
    .from('recordings')
    .update({ title: editedTitle.trim() })
    .eq('id', recording.id);
    
  if (!error) {
    toast({ title: "Titel aktualisiert" });
    setIsEditingTitle(false);
  }
};

// UI: Klickbarer Titel mit Bearbeiten-Icon
<div className="flex items-center gap-2">
  {isEditingTitle ? (
    <Input 
      value={editedTitle}
      onChange={(e) => setEditedTitle(e.target.value)}
      onBlur={handleTitleSave}
      onKeyDown={(e) => e.key === 'Enter' && handleTitleSave()}
      autoFocus
    />
  ) : (
    <>
      <SheetTitle onClick={() => setIsEditingTitle(true)} className="cursor-pointer">
        {recording.title || 'Untitled Meeting'}
      </SheetTitle>
      <Button variant="ghost" size="icon" onClick={() => setIsEditingTitle(true)}>
        <Pencil className="h-4 w-4" />
      </Button>
    </>
  )}
</div>
```

### 3. Kalender-Meeting-Titel bei automatischem Recording-Start übernehmen

Für automatisch geplante Aufnahmen über den Kalender (Recall.ai) muss der Titel bereits beim Erstellen des Recordings gesetzt werden.

**Recherche-Ergebnis:** Recall.ai erstellt Recordings automatisch wenn `will_record` aktiv ist. Der Webhook `meeting-bot-webhook` empfängt bereits den Titel. Dieser muss an das Recording weitergegeben werden.

**Lösung:** In `sync-recording` wird der Titel aus den Kalender-Meeting-Daten geholt (bereits implementiert in Schritt 1).

## Zusammenfassung der Änderungen

| Datei | Änderung |
|-------|----------|
| `supabase/functions/sync-recording/index.ts` | Kalender-Titel aus `calendarMeeting.title` übernehmen wenn Recording keinen Titel hat |
| `src/components/recordings/RecordingDetailSheet.tsx` | Bearbeitbares Titel-Feld mit Pencil-Icon, Inline-Editing und Speichern in Supabase |

## Ergebnis

- **Automatische Kalender-Titel**: Meetings aus dem Kalender übernehmen automatisch deren Titel in die Aufnahme
- **AI-Fallback**: Wenn kein Kalender-Titel vorhanden ist (z.B. bei manuellem Bot-Start), generiert die AI einen passenden Titel
- **Manuelle Bearbeitung**: Der Titel kann jederzeit in der Aufnahme-Detailansicht geändert werden
- **Reihenfolge der Titel-Quellen**:
  1. Kalender-Meeting-Titel (wenn verfügbar)
  2. AI-generierter Titel basierend auf Transkript-Inhalt
  3. Manuell bearbeiteter Titel (überschreibt beide)
