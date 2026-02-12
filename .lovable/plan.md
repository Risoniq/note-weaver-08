

## Meeting-Titel aus Recall.ai Metadaten abgreifen (manueller Bot-Beitritt)

### Problem
Wenn der Bot manuell zu einem Meeting hinzugefuegt wird (kein Kalender), bleibt der Titel leer bis die KI-Analyse nach Meeting-Ende einen generiert. Die Meeting-Plattformen (Zoom, Google Meet) stellen aber den Titel bereit, sobald der Bot im Meeting ist - dieser wird aktuell nicht abgefragt.

### Loesung

Recall.ai bietet ein `meeting_metadata`-Feature, das den Meeting-Titel direkt von der Plattform extrahiert (Zoom: vollstaendig, Google Meet: eingeschraenkt, Teams: nur mit Sign-in). Dieses muss beim Bot-Erstellen aktiviert und beim Sync ausgelesen werden.

### Aenderungen

**1. `create-bot/index.ts` - Meeting Metadata aktivieren**

Im `recording_config`-Objekt wird `meeting_metadata: {}` hinzugefuegt. Das aktiviert die Metadata-Erfassung bei Recall.ai, sodass der Meeting-Titel automatisch gesammelt wird sobald der Bot dem Meeting beitritt.

Vorher:
```
recording_config: {
  transcript: { ... }
}
```

Nachher:
```
recording_config: {
  transcript: { ... },
  meeting_metadata: {}
}
```

**2. `sync-recording/index.ts` - Meeting-Titel aus Bot-Metadaten extrahieren**

Nach dem Abrufen der `botData` von Recall.ai wird der Meeting-Titel aus den Metadaten extrahiert. Dies geschieht in der bestehenden Sync-Logik (Abschnitt 7), BEVOR der Kalender-Titel geprueft wird:

- Pfad: `botData.recordings?.[0]?.media_shortcuts?.meeting_metadata?.data?.title`
- Der Metadata-Titel wird nur gesetzt wenn der aktuelle Titel generisch/leer ist (gleiche `isGenericTitle`-Logik wie bereits vorhanden)
- Prioritaet: Kalender-Titel > Metadata-Titel > AI-generierter Titel

Die neue Logik wird zwischen Zeile 200 (nach `updates` Initialisierung) und Zeile 203 (vor dem Kalender-Check) eingefuegt:

```
// Meeting-Titel aus Recall.ai Metadaten extrahieren (funktioniert bei manuellem Beitritt)
const metadataTitle = botData.recordings?.[0]?.media_shortcuts?.meeting_metadata?.data?.title;
if (metadataTitle && metadataTitle.trim()) {
  const currentTitle = recording.title?.trim().toLowerCase() || '';
  // Nur setzen wenn aktueller Titel generisch ist
  if (isGeneric(currentTitle)) {
    updates.title = metadataTitle.trim();
    console.log('Meeting-Titel aus Metadata uebernommen:', metadataTitle);
  }
}
```

### Plattform-Unterstuetzung

| Plattform | Titel verfuegbar? |
|-----------|-------------------|
| Zoom | Ja (vollstaendig) |
| Google Meet | Eingeschraenkt (Bot muss eingeloggt sein) |
| Microsoft Teams | Nein (Bot muesste eingeloggt sein) |

Fuer Teams-Meetings greift weiterhin die KI-Titel-Generierung aus dem Transkript als Fallback.

### Keine Datenbank-Aenderungen noetig
