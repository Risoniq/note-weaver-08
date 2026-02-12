

## Recordings reparieren und aufraumen

### 1. Recording `095908e4` synchronisieren (reparierbar)

Dieses Recording hat bei Recall.ai sowohl ein **Video** als auch ein **Transkript** (Streaming-Transkript), wurde aber nie korrekt in die Datenbank synchronisiert. 

**Aktion:** `sync-recording` mit `force_resync: true` fuer Recording-ID `095908e4-22a7-4f44-b4c9-b07189a8e735` aufrufen. Das holt Video-URL und Transkript von Recall.ai, speichert es in der DB und startet die KI-Analyse.

### 2. Nicht reparierbare Recordings aufraumen

6 Recordings haben bei Recall.ai **keine Aufnahmen**, weil die Bots entweder:
- aus dem Warteraum gekickt wurden (5x)
- einen ungueltigen Meeting-Link hatten (1x)

Diese Recordings blockieren die Ansicht und zeigen leere Eintraege.

**Aktion:** Status dieser 6 Recordings auf `"error"` setzen und einen beschreibenden Titel hinzufuegen, damit klar ist, warum kein Transkript vorhanden ist:

| Recording ID | Neuer Titel |
|---|---|
| `b49363db-...` | "Bot aus Warteraum entfernt" |
| `8ef3df81-...` | Behaelt "AH Lambeck Sven Krause Teil 1" (hat schon Titel) |
| `a40679da-...` | "Bot aus Warteraum entfernt" |
| `298d8ac7-...` | "Meeting-Link ungueltig" |
| `89a1b149-...` | "Bot aus Warteraum entfernt" |
| `fb309341-...` | "Bot Warteraum-Timeout" |

### 3. Laufendes Recording belassen

Recording `9d9bc207` (Bot `e083c609`) ist aktuell im Status "recording" - das Meeting laeuft gerade. Hier wird nichts geaendert.

### 4. Geplantes Meeting belassen

Recording `f96acac5` (Meeting am 23.02.2026) ist korrekt im Status "pending".

### Technische Umsetzung

1. **sync-recording aufrufen** fuer `095908e4` (ueber Edge Function curl)
2. **SQL-Update** fuer die 6 nicht reparierbaren Recordings: Status auf `error`, Titel setzen
3. Keine Code-Aenderungen noetig - nur Daten-Operationen

