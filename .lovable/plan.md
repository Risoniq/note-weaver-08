

# Projekt-Strategie-Chat auf der Projektdetailseite

## Uebersicht

Ein neuer Chat-Bereich wird unterhalb des Proaktivitaets-Netzdiagramms auf der Projektdetailseite eingefuegt. Dieser Chat ist speziell auf strategisches Projektmanagement ausgerichtet und nutzt die vollstaendige Projektanalyse sowie alle zugeordneten Meeting-Daten als Kontext.

## Aenderungen

### 1. Neue Edge Function: `project-chat`

**Datei:** `supabase/functions/project-chat/index.ts`

Streamt Antworten ueber die Lovable AI Gateway. Erhaelt `projectId` und `messages` im Request-Body. Laedt automatisch:
- Projektname, Beschreibung, Status
- Die gespeicherte KI-Analyse (Zusammenfassung, Empfehlungen, offene/erledigte Themen, Topic-Tracking)
- Alle zugeordneten Meeting-Transkripte (Titel, Zusammenfassung, Key Points, Action Items)

**System-Prompt** (strategisches Projektmanagement):

```
Du bist ein strategischer Projektmanagement-Berater. Du analysierst Projekte ganzheitlich und
gibst konkrete, umsetzbare Empfehlungen. Du hast Zugriff auf alle Meetings, Analysen und den
aktuellen Projektstatus.

DEINE KERNKOMPETENZEN:
1. Strategische Bewertung: Projektfortschritt, Risiken, Engpaesse identifizieren
2. Potentialanalyse: Ungenutzte Chancen und Synergien zwischen Themen aufdecken
3. Priorisierung: Welche Themen Aufmerksamkeit brauchen, was zurueckgestellt werden kann
4. Stakeholder-Dynamik: Wer treibt welche Themen, wo fehlt Verantwortung
5. Handlungsempfehlungen: Konkrete naechste Schritte mit Begruendung

REGELN:
- Antworte auf Deutsch, kurz und praegnant
- Keine Markdown-Sternchen, normaler Fliesstext
- Bei Aufzaehlungen: Nummeriert, neue Zeile pro Punkt
- Beziehe dich immer auf konkrete Daten aus den Meetings
- Stelle Rueckfragen wenn die Anfrage zu vage ist
- Denke in Zusammenhaengen: Wie haengen verschiedene Meeting-Themen zusammen?
- Bewerte kritisch: Nicht nur zusammenfassen, sondern Luecken und Risiken benennen
```

### 2. Neue Komponente: `ProjectChatWidget`

**Datei:** `src/components/projects/ProjectChatWidget.tsx`

Wiederverwendet das gleiche Chat-Pattern wie `MeetingChatWidget` (SSE-Streaming, ScrollArea, VoiceInput). Props: `projectId`, `projectName`.

Platzhalter-Text: "Frag nach Projektpotentialen, Risiken oder strategischen Empfehlungen..."

### 3. Integration in ProjectDetail

**Datei:** `src/pages/ProjectDetail.tsx`

Einfuegen der `ProjectChatWidget`-Komponente nach der `IFDProactivityRadar`-Komponente (Zeile 185), also direkt unter dem Proaktivitaets-Netzdiagramm:

```tsx
<ProjectChatWidget projectId={id!} projectName={project.name} />
```

## Technische Details

- Die Edge Function nutzt `LOVABLE_API_KEY` (bereits konfiguriert) und `google/gemini-3-flash-preview`
- Authentifizierung ueber den Authorization-Header des eingeloggten Nutzers
- Projekt-Ownership wird geprueft (nur eigene oder geteilte Projekte)
- SSE-Streaming fuer Echtzeit-Antworten
- Keine Datenbank-Aenderungen noetig
