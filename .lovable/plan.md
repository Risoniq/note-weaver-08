

# Erweiterte Projekt-Analyse: Themen-Tracking, Proaktivitaet und Bereichs-Farben

## Uebersicht

Die Projektanalyse wird um drei wesentliche Dimensionen erweitert:

1. **Themen-Verfolgung in der Timeline** - Erkennung, ob Punkte in Folge-Meetings wiederholt werden (verfolgt vs. verloren)
2. **Proaktivitaets-Radar mit Themenbezug** - Zeigt, wie aktiv Teilnehmer sich relativ zur Thematik einbringen
3. **Bereichs-Farben** - Automatische Kategorisierung in Marketing, Produkt, Sales und Operations mit farblicher Darstellung

## Loesung

### Schritt 1: Edge Function `analyze-project` erweitern

Der KI-Prompt wird erweitert, damit die Analyse zusaetzlich liefert:

- **`topic_tracking`**: Array von Themen mit Angabe, in welchen Meetings sie vorkommen und ob sie "verfolgt" oder "offen" sind
- **`domain_distribution`**: Pro Meeting eine prozentuale Aufteilung in die Bereiche Marketing, Produkt, Sales, Operations
- **`speaker_domain_activity`**: Pro Sprecher, in welchem Bereich sie am aktivsten sind

**Datei:** `supabase/functions/analyze-project/index.ts`

Der Prompt wird um folgende JSON-Felder ergaenzt:

```
- "topic_tracking": Array von Objekten mit {"topic": string, "meetings": number[], "status": "verfolgt"|"offen"|"erledigt"}
- "domain_distribution": Array von Objekten mit {"meeting": string, "marketing": number, "produkt": number, "sales": number, "operations": number} (Prozente, Summe = 100)
- "speaker_domain_activity": Array von {"speaker": string, "marketing": number, "produkt": number, "sales": number, "operations": number}
```

### Schritt 2: Fortschritts-Timeline ueberarbeiten

Die bisherige `IFDTimeline` wird ersetzt durch eine **gestapelte Flaechenansicht**, die pro Meeting die Bereichsverteilung zeigt (Marketing = blau, Produkt = violett, Sales = orange, Operations = gruen). Zusaetzlich werden wiederkehrende Themen als Marker hervorgehoben.

**Datei:** `src/components/projects/IFDTimeline.tsx`

- Statt einfacher Linien fuer actionItems/keyPoints wird ein AreaChart mit den vier Bereichen verwendet
- Unter dem Chart: Eine kompakte Liste der verfolgten vs. offenen Themen mit Badges

### Schritt 3: Themen-Cloud durch Bereichs-Uebersicht ersetzen

Die bisherige Wort-Heatmap (`IFDTopicCloud`) wird durch eine **Bereichs-Donut-Chart** mit detaillierter Themen-Liste ersetzt.

**Datei:** `src/components/projects/IFDTopicCloud.tsx`

- Donut/Pie-Chart mit den vier Bereichsfarben und prozentualer Verteilung
- Darunter: Themen gruppiert nach Bereich mit Status-Badge (verfolgt/offen/erledigt)

### Schritt 4: Proaktivitaets-Radar um Bereichsbezug erweitern

Das bestehende Radar-Chart behaelt die fuenf Dimensionen, erhaelt aber eine zusaetzliche Ansicht, die zeigt, in welchem Bereich jeder Sprecher am aktivsten ist.

**Datei:** `src/components/projects/IFDProactivityRadar.tsx`

- Unter dem Radar: Kleine horizontale Balken pro Sprecher mit Bereichs-Farben

### Schritt 5: ProjectDetail-Seite anpassen

**Datei:** `src/pages/ProjectDetail.tsx`

- Die `analysis`-Daten werden an die neuen Komponenten weitergereicht
- Neuer Abschnitt "Themen-Verfolgung" zwischen KI-Analyse und Charts

## Bereichs-Farben (konsistent ueberall)

| Bereich    | Farbe   | Hex       |
|------------|---------|-----------|
| Marketing  | Blau    | #3b82f6   |
| Produkt    | Violett | #8b5cf6   |
| Sales      | Orange  | #f59e0b   |
| Operations | Gruen   | #22c55e   |

## Technische Details

### Erweiterter KI-Prompt (analyze-project)

```typescript
const prompt = `Analysiere die folgenden ${recordings.length} Meetings...

Erstelle eine JSON-Antwort mit:
- "summary": Gesamtzusammenfassung (2-3 Saetze)
- "progress": Fortschrittsbewertung (1-2 Saetze)
- "open_topics": Array offener Themen
- "completed_topics": Array erledigter Themen
- "recommendations": Array mit 3-5 Empfehlungen
- "topic_tracking": Array von {"topic": "Thema", "meetings": [1, 3, 5], "status": "verfolgt|offen|erledigt"} - tracke welche Themen in welchen Meetings besprochen wurden
- "domain_distribution": Array von {"meeting": "Meeting-Titel", "marketing": 20, "produkt": 40, "sales": 30, "operations": 10} - prozentuale Verteilung pro Meeting
- "speaker_domain_activity": Array von {"speaker": "Name", "marketing": 15, "produkt": 50, "sales": 25, "operations": 10}

Antworte NUR mit validem JSON.`;
```

### Neue IFDTimeline (AreaChart mit Bereichen)

```typescript
// Stacked AreaChart mit domain_distribution Daten
<AreaChart data={domainData}>
  <Area type="monotone" dataKey="marketing" stackId="1" fill="#3b82f6" />
  <Area type="monotone" dataKey="produkt" stackId="1" fill="#8b5cf6" />
  <Area type="monotone" dataKey="sales" stackId="1" fill="#f59e0b" />
  <Area type="monotone" dataKey="operations" stackId="1" fill="#22c55e" />
</AreaChart>
```

### Themen-Tracking Darstellung

Unter der Timeline wird eine kompakte Liste angezeigt:

```
[verfolgt] Website-Fertigstellung - Meeting 2, 4, 6
[offen]   Telefonie-Stresstests - Meeting 3
[erledigt] Leads Qualitaetszuwachs - Meeting 1, 2
```

Mit farbigen Badges fuer den Status (gruen = verfolgt, gelb = offen, grau = erledigt).

### Datenfluss

Die KI-generierten Daten werden im `analysis` JSON-Feld der `projects`-Tabelle gespeichert. Die Frontend-Komponenten lesen diese Daten direkt aus dem Projekt-Objekt - keine zusaetzliche Datenbank-Aenderung noetig.

## Erwartetes Ergebnis

- Die Timeline zeigt auf einen Blick, welcher Geschaeftsbereich in welchem Meeting dominierte
- Wiederkehrende Themen werden sichtbar getrackt (verfolgt vs. verloren gegangen)
- Jeder Sprecher bekommt eine Bereichs-Zuordnung in der Proaktivitaetsansicht
- Konsistente Farbcodierung ueber alle Charts hinweg

