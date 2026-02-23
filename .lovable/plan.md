
# Umfangreiche Risikoanalyse fuer den Notetaker

## Ueberblick

Der lokale Notetaker (Browser-Aufnahme) soll nach jeder Aufnahme eine umfangreiche KI-gestuetzte Analyse erhalten -- inklusive einer vollstaendigen Risikoanalyse nach dem Muster der hochgeladenen Excel-Vorlage (Risikodokumentation). Aktuell nutzt der Notetaker nur eine einfache regelbasierte Analyse ohne KI. Das wird auf eine KI-basierte Analyse umgestellt.

## Was sich aendert

### 1. Erweitertes Analyse-Datenmodell

Die `MeetingAnalysis`-Struktur wird um eine Risikoanalyse erweitert. Jedes Risiko enthaelt alle Spalten aus der Excel-Vorlage:

- Nr.
- Risikobereich
- Beschreibung
- Eintrittswahrscheinlichkeit (Niedrig / Mittel / Hoch)
- Auswirkung (Niedrig / Mittel / Hoch)
- Risikoniveau (Niedrig / Mittel / Hoch)
- Massnahmen / Kontrollen
- Verantwortlich
- Nachweis / Dokument

### 2. Neue Edge-Funktion: `analyze-notetaker`

Eine neue Backend-Funktion, die das Transkript per KI analysiert und zurueckliefert:

- Zusammenfassung (2-3 Saetze)
- Key Points (3-5 Punkte)
- Action Items (mit Verantwortlichen)
- Risikoanalyse (5-10 Risiken im Excel-Format)

Die Funktion nutzt das Lovable AI Gateway (google/gemini-2.5-flash) und erwartet das Transkript direkt im Request Body (kein Datenbank-Lookup noetig, da der Notetaker lokal arbeitet).

### 3. Analyse nach Aufnahme-Ende

Wenn die Aufnahme endet, wird der bisherige lokale `generateAnalysis()`-Aufruf durch einen Aufruf an die neue Edge-Funktion ersetzt. Die lokale Funktion bleibt als Fallback bestehen, falls die KI nicht erreichbar ist.

### 4. Risiko-Anzeige im Meeting-Detail-Modal

Das `MeetingDetailModal` erhaelt einen neuen Abschnitt "Risikoanalyse" mit einer uebersichtlichen Tabellen-/Kartenansicht:

- Jedes Risiko als Karte mit farbcodiertem Risikoniveau (Rot=Hoch, Gelb=Mittel, Gruen=Niedrig)
- Alle 8 Felder aus der Excel-Vorlage sichtbar
- Responsive Darstellung (Tabelle auf Desktop, Karten auf Mobil)

### 5. Download mit Risikoanalyse

Die `downloadTranscript`-Funktion wird erweitert, damit das heruntergeladene TXT-Dokument auch die vollstaendige Risikoanalyse enthaelt -- formatiert aehnlich wie die Excel-Vorlage.

## Technische Details

### Dateien die erstellt werden

| Datei | Beschreibung |
|-------|-------------|
| `supabase/functions/analyze-notetaker/index.ts` | Neue Edge-Funktion fuer KI-Analyse mit Risikobewertung |

### Dateien die geaendert werden

| Datei | Aenderung |
|-------|-----------|
| `src/types/meeting.ts` | `MeetingAnalysis` um `risks: RiskItem[]` erweitern |
| `src/components/MeetingNoteTaker.tsx` | Nach Aufnahme-Ende die Edge-Funktion aufrufen statt lokaler Analyse |
| `src/components/meeting/MeetingDetailModal.tsx` | Neuen Abschnitt "Risikoanalyse" mit Tabelle/Karten hinzufuegen |
| `src/utils/meetingAnalysis.ts` | Download-Funktion um Risiko-Sektion erweitern |

### KI-Prompt (Kernlogik)

Der Prompt an die KI enthaelt die Anweisung, neben Summary/Key Points/Action Items auch eine Risikoanalyse im JSON-Format zurueckzugeben:

```text
Analysiere das Transkript und erstelle:
1. Zusammenfassung (2-3 Saetze)
2. Key Points (3-5 wichtigste Punkte)
3. Action Items (mit Verantwortlichen)
4. Risikoanalyse: Identifiziere 5-10 Risiken mit:
   - Risikobereich
   - Beschreibung
   - Eintrittswahrscheinlichkeit (Niedrig/Mittel/Hoch)
   - Auswirkung (Niedrig/Mittel/Hoch)
   - Risikoniveau (Niedrig/Mittel/Hoch)
   - Massnahmen/Kontrollen
   - Verantwortlich
   - Nachweis/Dokument
```

### Ablauf nach Aufnahme

```text
Aufnahme stoppt
    |
    v
Lokale Schnellanalyse (Fallback)
    |
    v
Edge-Funktion aufrufen mit Transkript
    |
    v
KI generiert vollstaendige Analyse + Risiken
    |
    v
Meeting in localStorage aktualisieren
    |
    v
UI zeigt vollstaendige Analyse mit Risikoanalyse
```
