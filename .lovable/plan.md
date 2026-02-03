
# Plan: Titel-Bearbeitung für alle Meeting-Ansichten

## Übersicht

Der Meeting-Titel soll überall bearbeitbar sein, wo er prominent angezeigt wird. Die existierende `EditableTitle` Komponente wird wiederverwendet und für die MeetingDetail-Seite angepasst.

## Aktueller Stand

| Ort | Bearbeitbar | Status |
|-----|-------------|--------|
| RecordingDetailSheet | ✅ Ja | Bereits implementiert |
| MeetingDetail-Header | ❌ Nein | **Muss erweitert werden** |
| RecordingCard (Liste) | ❌ Nein | Nicht nötig (Klick öffnet Detail) |
| TranscriptCard | ❌ Nein | Nicht nötig (Klick öffnet Detail) |

## Änderungen

### MeetingDetail.tsx - Header mit EditableTitle

Die aktuelle statische Titel-Anzeige wird durch die EditableTitle-Komponente ersetzt:

**Vorher:**
```text
┌────────────────────────────────────────────────┐
│ ← Meeting Bot Test 2025-01-15              🟢 │
│   Freitag, 15. Januar 2025 um 14:30 Uhr       │
└────────────────────────────────────────────────┘
```

**Nachher:**
```text
┌────────────────────────────────────────────────────┐
│ ← Meeting Bot Test 2025-01-15  ✏️           🟢    │
│   Freitag, 15. Januar 2025 um 14:30 Uhr           │
└────────────────────────────────────────────────────┘
       ↑ Hover zeigt Bearbeiten-Symbol
```

### Anpassung EditableTitle-Komponente

Die bestehende Komponente muss für verschiedene Größen erweitert werden:

| Prop | Typ | Beschreibung |
|------|-----|--------------|
| size | "default" \| "large" | Steuert Schriftgröße |
| onTitleChange | callback | Lokales State-Update |

- `default`: Aktuelle Größe (text-xl) für Sheet
- `large`: Größere Variante (text-3xl) für MeetingDetail-Header

### Lokales State-Update

Nach dem Speichern des Titels wird das lokale Recording-State aktualisiert, sodass die Änderung sofort sichtbar ist ohne Neuladen.

## Dateien

| Datei | Aktion |
|-------|--------|
| `src/components/recordings/EditableTitle.tsx` | Erweitern um `size` Prop |
| `src/pages/MeetingDetail.tsx` | EditableTitle im Header einbinden |

## Benutzer-Flow

1. Nutzer öffnet Meeting-Detailseite
2. Hover über Titel zeigt kleines Stift-Symbol
3. Klick auf Titel oder Symbol aktiviert Bearbeitungsmodus
4. Eingabefeld erscheint mit aktuellem Titel
5. Enter speichert, Escape bricht ab
6. Toast-Nachricht bestätigt Speicherung
7. Titel wird in Datenbank aktualisiert (RLS: `user_id = auth.uid()`)

## Sicherheit

Die Bearbeitung nutzt Supabase RLS-Policies, die sicherstellen, dass nur der Eigentümer eines Recordings dessen Titel ändern kann:

```sql
-- Existierende Policy
Policy: Users can update own recordings
Command: UPDATE
Using Expression: (auth.uid() = user_id)
```
