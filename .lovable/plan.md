

## Video-Download-Button auf der Meeting-Detail-Seite

### Ziel

Auf der Meeting-Detail-Seite (`/meeting/:id`) wird unterhalb des Video-Players ein "Video herunterladen"-Button hinzugefuegt, damit User das Video direkt aus der Analyse herunterladen koennen.

### Aktuelle Situation

- Die Video-Karte (Zeile 1305-1326 in `MeetingDetail.tsx`) zeigt nur den Video-Player
- Kein Download-Button vorhanden
- In der `RecordingDetailSheet` existiert bereits ein funktionierender Download-Button als Referenz

### Aenderung

In `src/pages/MeetingDetail.tsx` wird unterhalb des Video-Players ein Download-Button eingefuegt:

| Datei | Aenderung |
|---|---|
| `src/pages/MeetingDetail.tsx` | Download-Button unterhalb des Video-Players in der Video-Card einfuegen |

### Details

- Der Button wird nach dem `aspect-video`-Container aber noch innerhalb der `CardContent` platziert
- Styling: `variant="outline"` mit Download-Icon, konsistent zum Rest der Seite
- Oeffnet die `video_url` in einem neuen Tab zum Herunterladen
- Das `Download`-Icon ist bereits importiert (Zeile 33)
- Keine neuen Abhaengigkeiten noetig

