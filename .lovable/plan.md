

## Ziel
Die Chat-Funktion reparieren, indem die fehlende `single-meeting-chat` Edge Function deployed wird.

## Diagnose

### Status der Chat-Funktionen

| Komponente | Edge Function | Status | Test-Ergebnis |
|---|---|---|---|
| Dashboard-Chat (alle Meetings) | `meeting-chat` | Deployed | 200 OK, Streaming funktioniert |
| Einzelmeeting-Chat (Deep Dive) | `single-meeting-chat` | **NICHT deployed** | **404 NOT_FOUND** |

### Wo wird welcher Chat verwendet?

- **Dashboard-Seite** (`src/components/dashboard/MeetingChatWidget.tsx`): Nutzt `meeting-chat` -- funktioniert
- **Deep Dive Modal** (`src/components/meeting/MeetingChatWidget.tsx`): Nutzt `single-meeting-chat` -- **fehlerhaft (404)**

### Ursache
Die `single-meeting-chat` Edge Function existiert im Code, wurde aber nicht zum Server deployed. Dadurch bekommt der Browser einen 404-Fehler, wenn der Chat im Deep Dive Modal genutzt wird.

---

## Umsetzung

### Schritt 1: single-meeting-chat deployen

Die bestehende Edge Function unter `supabase/functions/single-meeting-chat/index.ts` wird deployed. Der Code ist vollständig und korrekt:
- Authentifizierung via JWT
- Empfang von Transkript, Meeting-Titel, Summary, Key Points, Action Items
- Streaming-Antwort via Lovable AI Gateway (google/gemini-3-flash-preview)

### Schritt 2: Funktionstest

Nach dem Deployment wird die Funktion mit einem POST-Request getestet um sicherzustellen, dass sie erreichbar ist und korrekt antwortet.

---

## Betroffene Dateien

| Datei | Aenderung |
|-------|----------|
| `supabase/functions/single-meeting-chat/index.ts` | Keine Code-Aenderung noetig -- nur Deployment |

## Geschaetzter Aufwand
- Nur ein Deployment-Schritt, keine Code-Aenderungen erforderlich
