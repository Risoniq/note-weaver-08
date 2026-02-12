

## Genauere Meeting-Titel aus Transkript-Inhalten

### Problem
Aktuell werden Meeting-Titel entweder aus dem Kalender uebernommen (falls vorhanden) oder von der KI generiert. Die KI-generierten Titel sind oft zu generisch ("Team Meeting", "Besprechung") und nicht aussagekraeftig genug.

### Loesung

**1. Besserer KI-Prompt fuer Titel-Generierung (`analyze-transcript`)**

Der aktuelle Prompt ist zu vage ("kurzer, aussagekraeftiger Titel, max 50 Zeichen"). Er wird verbessert:

- Laengere Titel erlauben (max 80 Zeichen statt 50)
- Konkretere Anweisungen: Firmennamen, Projektnamen, Themen aus dem Transkript verwenden
- Beispiele anpassen: Statt "Team Standup" lieber "Projekt Alpha - Sprint Review mit Firma XY"
- Teilnehmer-Namen und Firmen aus dem Transkript extrahieren und im Titel verwenden
- Regel: Der Titel soll das SPEZIFISCHE Thema widerspiegeln, nicht nur die Meeting-Art

**2. Kalender-Titel auch nach Beitritt aktualisieren (`sync-recording`)**

Aktuell wird der Kalender-Titel nur gesetzt wenn `!recording.title`. Aenderung:
- Den Kalender-Titel IMMER laden und in einem neuen Feld `calendar_title` speichern (fuer Referenz)
- Wenn der Kalender-Titel aussagekraeftiger ist als "Meeting" oder ein generischer Bot-Name, diesen bevorzugen
- Wenn kein Kalender-Titel vorhanden ist, die KI einen besseren Titel generieren lassen

**3. Titel-Aktualisierung nach Analyse erzwingen**

In `analyze-transcript` wird die Bedingung gelockert:
- Wenn der aktuelle Titel generisch ist (z.B. nur "Meeting", "Besprechung", oder ein UUID-Fragment), wird der KI-generierte Titel trotzdem uebernommen
- Manuell gesetzte, spezifische Titel werden weiterhin NICHT ueberschrieben

### Technische Details

**`supabase/functions/analyze-transcript/index.ts`:**
- Prompt-Anpassung fuer spezifischere Titel:
  - Anweisung: "Extrahiere konkrete Themen, Firmennamen, Projektnamen aus dem Gespraech"
  - Max 80 Zeichen statt 50
  - Bessere Beispiele mit echtem Kontext
- Neue Logik: Titel wird auch ueberschrieben wenn der bestehende Titel "generisch" ist (Pruefung via Regex/Wortliste: "Meeting", "Besprechung", "Untitled", Meeting-ID-Fragmente)

**`supabase/functions/sync-recording/index.ts`:**
- Zeile 221: Bedingung aendern von `if (!recording.title && calendarMeeting.title)` zu: Kalender-Titel immer laden, aber nur setzen wenn noch kein manueller Titel existiert ODER der bestehende Titel generisch ist
- Bei jedem Sync den Kalender-Titel erneut pruefen (nicht nur beim ersten Mal)

### Keine Datenbank-Aenderungen noetig
Die bestehenden Felder `title` in der `recordings`-Tabelle reichen aus.

