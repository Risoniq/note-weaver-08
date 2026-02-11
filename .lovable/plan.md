

## Zwei Massnahmen: Bot-Daten retten + Auto-Ingest Zeitfenster erweitern

### 1. Sofort-Massnahme: Bot-Daten wiederherstellen

Sobald du die Bot-ID aus dem Recall.ai Dashboard lieferst, werde ich:
- Einen `recordings`-Eintrag mit dieser Bot-ID fuer User `so@ec-pd.com` erstellen
- `sync-recording` triggern, um Transkript und Video von Recall.ai zu holen
- Falls der Bot manuell entfernt wurde, hat Recall.ai moeglicherweise trotzdem eine Teilaufnahme gespeichert

**Aktion erforderlich**: Bitte die Bot-ID aus dem Recall.ai Dashboard kopieren.

### 2. Bug-Fix: Zeitfenster fuer Auto-Ingest erweitern

**Problem**: Die `list`-Action in `recall-calendar-meetings` holt nur Meetings der letzten 2 Stunden:
```
const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
```

Wenn der User die Kalender-Seite nicht innerhalb von 2 Stunden nach Meeting-Start oeffnet, wird das Meeting nie erkannt und kein Recording angelegt.

**Loesung**: Das Zeitfenster auf **24 Stunden** erweitern:

**Datei: `supabase/functions/recall-calendar-meetings/index.ts`**
- Zeile 144: `2 * 60 * 60 * 1000` aendern zu `24 * 60 * 60 * 1000`
- Log-Meldung entsprechend anpassen

Dies stellt sicher, dass auch Meetings vom Vortag noch erkannt und automatisch als Recording angelegt werden, solange der User mindestens einmal taeglich die App oeffnet.

### Technische Details

```text
Vorher (2h Fenster):
  Meeting um 14:00 -> User oeffnet App um 16:30 -> Meeting nicht mehr sichtbar -> Verloren

Nachher (24h Fenster):
  Meeting um 14:00 -> User oeffnet App um 16:30 -> Meeting noch sichtbar -> Auto-Ingest greift
```

Keine weiteren Dateien betroffen. Die Aenderung ist minimal (eine Zeile) und hat keine Nebenwirkungen, da die Auto-Ingest-Logik bereits Duplikate verhindert.

