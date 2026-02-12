

## Aufnahmen-Ansicht: Listenansicht mit Benutzer-Infos und Filter

### Ziel
Die Aufnahmen werden in einer vertikalen Liste (statt im 3-Spalten-Grid) angezeigt, mit Informationen zum jeweiligen Benutzer/Account und einer Filteroption nach Benutzer.

### Aenderungen

**1. RecordingsList: Grid durch Listenansicht ersetzen**
- Das aktuelle 3-Spalten-Grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`) wird durch eine einspaltige Liste (`space-y-3`) ersetzt
- Jede Karte zeigt den Besitzer (E-Mail) als Badge an, nicht nur im Team-Modus

**2. RecordingCard: Mehr Informationen anzeigen**
- Zusammenfassung (summary) als Vorschautext hinzufuegen (1-2 Zeilen, abgeschnitten)
- Besitzer-E-Mail als zusaetzliches Metadatum anzeigen (neues optionales Prop `ownerEmail`)
- Teilnehmer-Anzahl anzeigen, wenn vorhanden
- Layout bleibt horizontal kompakt fuer Listenansicht

**3. Recordings-Seite: Benutzer-Filter auch im Aufnahmen-Tab**
- Der bestehende Mitglieder-Filter (Select-Dropdown) wird auch im "Aufnahmen"-Tab angezeigt, wenn Team-Modus aktiv ist
- Die `RecordingsList`-Komponente erhaelt die `memberEmails`-Map als Prop, um Besitzer-Namen anzuzeigen
- Der Benutzer-Filter ist bereits implementiert und wird nur sichtbar gemacht

### Technische Details

**RecordingCard.tsx** - Neue Props:
```
ownerEmail?: string   // E-Mail des Besitzers
```
Neue Anzeige-Elemente:
- Besitzer-Badge mit User-Icon neben dem Datum
- Summary-Text unterhalb der Meta-Infos (line-clamp-2)

**RecordingsList.tsx** - Layout-Aenderung:
- Grid-Klassen von `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4` zu `flex flex-col gap-3`
- `ownerEmail` wird aus der `memberEmails`-Map an jede RecordingCard weitergegeben

**Recordings.tsx** - Filter-Integration:
- `memberEmails`-Daten werden auch im Aufnahmen-Tab genutzt
- Das Select-Dropdown fuer Mitglieder erscheint im Aufnahmen-Tab (Team-Modus)
- Die bestehende Filter-Logik aus dem Transkripte-Tab wird wiederverwendet

### Keine Datenbank-Aenderungen noetig
Alle benoetigten Daten (owner_email, user_id) sind bereits ueber die `teamlead-recordings` Edge Function verfuegbar.
