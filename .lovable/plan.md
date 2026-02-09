

## Suche und User-Filter im Aufnahmen-Tab

### Problem
Der "Aufnahmen"-Reiter zeigt alle Recordings ohne Moeglichkeit, nach Titel/Transkript zu suchen oder nach Team-Mitgliedern zu filtern.

### Loesung
Die Suchleiste und Filter direkt in den Aufnahmen-Tab integrieren, indem `RecordingsList` um Props fuer Suche und User-Filter erweitert wird.

### Aenderungen

| Datei | Aenderung |
|---|---|
| `src/components/recordings/RecordingsList.tsx` | Neue Props: `searchQuery` und `selectedMember`. Client-seitige Filterung der Recordings nach Titel, Transkript-Text, Summary und User-ID |
| `src/pages/Recordings.tsx` | Suchfeld und User-Filter-Dropdown oberhalb des Aufnahmen-Tabs hinzufuegen. Gemeinsame State-Variablen fuer beide Tabs nutzen |

### Technische Details

**RecordingsList.tsx:**
- Neue optionale Props: `searchQuery?: string`, `selectedMember?: string`
- Nach dem Laden der Recordings wird client-seitig gefiltert:
  - Titel, Transkript-Text und Summary werden gegen den Suchbegriff geprueft (case-insensitive)
  - Bei Team-Ansicht wird nach `user_id` des ausgewaehlten Mitglieds gefiltert
- Die angezeigte Anzahl in der Ueberschrift passt sich an die gefilterten Ergebnisse an

**Recordings.tsx (Aufnahmen-Tab):**
- Ein Suchfeld (Input mit Search-Icon) wird oberhalb des RecordingsList-Grids platziert
- Im Team-Modus erscheint zusaetzlich das User-Filter-Dropdown (wie bereits im Transkripte-Tab vorhanden)
- Die bestehenden `selectedMember`- und Such-State-Variablen werden fuer beide Tabs gemeinsam genutzt, sodass ein Wechsel zwischen Tabs die Filterung beibehalt
