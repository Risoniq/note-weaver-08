

## Transkripte in die Aufnahmen-Seite integrieren

### Ziel

Die Transkript-Datenbank wird als zweiter Tab in die bestehende Aufnahmen-Seite (`/recordings`) integriert. Der separate Navigationspunkt "Transkripte" in der Sidebar entfaellt. Nutzer finden kuenftig alles an einem Ort.

### Aufbau nach der Aenderung

```text
/recordings
+-----------------------------------------------+
| Aufnahmen                                      |
| Alle deine Meeting-Aufnahmen und Transkripte   |
|                                                |
| [Aufnahmen]  [Transkripte]    [Meine / Team]   |
|                                                |
| --- Tab: Aufnahmen ---                         |
| RecordingCard  RecordingCard  RecordingCard     |
| RecordingCard  RecordingCard  ...               |
|                                                |
| --- Tab: Transkripte ---                       |
| Suchleiste + Filter                            |
| TranscriptCard                                 |
| TranscriptCard                                 |
| Pagination                                     |
+-----------------------------------------------+
```

---

### Aenderungen im Detail

#### 1. Recordings-Seite erweitern (`src/pages/Recordings.tsx`)

- Tabs-Komponente (Radix Tabs) mit zwei Tabs hinzufuegen:
  - **"Aufnahmen"** -- zeigt die bestehende `RecordingsList`-Komponente (Karten-Grid)
  - **"Transkripte"** -- zeigt die Transkript-Suche, Filter, `TranscriptCard`-Liste und Pagination (bisherige Logik aus `Transcripts.tsx`)
- Der Team/Personal-Toggle bleibt oben rechts und wirkt auf beide Tabs
- Die Transkript-Logik (Daten laden, filtern, paginieren, exportieren) wird in die Recordings-Seite uebernommen

#### 2. Sidebar aktualisieren (`src/components/layout/AppSidebar.tsx`)

- Den Menue-Eintrag `{ title: "Transkripte", url: "/transcripts", icon: FileText }` entfernen

#### 3. Route beibehalten als Redirect (`src/App.tsx`)

- Die Route `/transcripts` wird zu `/recordings` weitergeleitet, damit bestehende Lesezeichen oder Links weiterhin funktionieren

#### 4. Keine Aenderung an bestehenden Komponenten

- `RecordingsList`, `RecordingCard`, `TranscriptCard`, `TranscriptSearch` bleiben unveraendert
- Die gesamte Transkript-Logik (Suche, Filter, Pagination, Export) wird 1:1 in den neuen Tab uebernommen

---

### Betroffene Dateien

| Datei | Aenderung |
|---|---|
| `src/pages/Recordings.tsx` | Tabs hinzufuegen, Transkript-Tab mit Suche/Filter/Liste/Pagination integrieren |
| `src/components/layout/AppSidebar.tsx` | "Transkripte"-Eintrag aus dem Menue entfernen |
| `src/App.tsx` | `/transcripts`-Route auf Redirect zu `/recordings` aendern |

### Geschaetzter Aufwand
- 3 Dateien, mittlerer Umfang (hauptsaechlich Recordings.tsx wird erweitert)

