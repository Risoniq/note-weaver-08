

# Chat-Verlauf persistent speichern mit Sidebar

## Uebersicht

Alle drei Chat-Widgets (Dashboard Meeting-Chat, Einzel-Meeting-Chat, Projekt-Chat) bekommen eine persistente Verlaufsfunktion. Nachrichten werden in der Datenbank gespeichert und beim naechsten Besuch automatisch geladen. Links neben dem Chat erscheint eine kleine Liste bisheriger Gespraeche mit automatisch generierten Titeln.

## 1. Neue Datenbank-Tabelle: `chat_sessions`

| Spalte | Typ | Beschreibung |
|---|---|---|
| id | uuid (PK) | Session-ID |
| user_id | uuid (NOT NULL) | Besitzer |
| context_type | text (NOT NULL) | `"dashboard"`, `"meeting"`, `"project"` |
| context_id | text | Meeting-ID oder Projekt-ID (null fuer Dashboard) |
| title | text | Auto-generierter Titel (erste User-Nachricht, gekuerzt) |
| messages | jsonb (NOT NULL, default '[]') | Array von {role, content} |
| created_at | timestamptz | Erstellzeit |
| updated_at | timestamptz | Letzte Aenderung |

RLS-Policies:
- SELECT/INSERT/UPDATE/DELETE: nur `auth.uid() = user_id`

## 2. Shared Hook: `useChatSessions`

Neuer Hook `src/hooks/useChatSessions.ts` der die gesamte Logik kapselt:

- `sessions`: Liste aller Sessions fuer einen bestimmten context_type + context_id
- `activeSession`: Aktuell geladene Session (Messages)
- `loadSession(id)`: Session laden
- `saveMessages(messages)`: Aktuelle Session updaten (debounced nach jeder Antwort)
- `createNewChat()`: Neue leere Session anlegen, als aktiv setzen
- `clearChat()`: Aktuelle Session loeschen
- `autoTitle(messages)`: Titel aus der ersten User-Nachricht ableiten (erste 40 Zeichen + "...")

Parameter: `{ contextType: string, contextId?: string }`

## 3. Gemeinsame Chat-History-Sidebar-Komponente

Neue Komponente `src/components/chat/ChatHistorySidebar.tsx`:

- Schmale Seitenleiste (links vom Chat, ca. 160px)
- Liste der bisherigen Sessions mit Titel und Datum
- Aktive Session hervorgehoben
- Button "Neuer Chat" oben (Plus-Icon)
- Klick auf Session laedt deren Nachrichten
- Kompakt: nur Titel (1 Zeile, abgeschnitten) + relative Zeit

## 4. Aenderungen an den Chat-Widgets

Alle drei Widgets bekommen die gleichen Erweiterungen:

### `/clear` Befehl
- Wenn der User `/clear` eingibt und absendet: aktuelle Session wird geloescht, Nachrichten werden geleert, neue Session wird gestartet

### Layout-Aenderung
- Das Chat-Widget wird in ein Flex-Layout gewandelt: `[ChatHistorySidebar | Chat-Bereich]`
- Die Sidebar ist schmal und scrollbar
- Auf kleinen Bildschirmen kann die Sidebar per Toggle ein-/ausgeklappt werden

### Betroffene Dateien

| Datei | Aenderung |
|---|---|
| `src/hooks/useChatSessions.ts` | Neuer Hook (CRUD fuer chat_sessions) |
| `src/components/chat/ChatHistorySidebar.tsx` | Neue Sidebar-Komponente |
| `src/components/dashboard/MeetingChatWidget.tsx` | Hook + Sidebar integrieren, /clear, Laden/Speichern |
| `src/components/meeting/MeetingChatWidget.tsx` | Hook + Sidebar integrieren, /clear, Laden/Speichern |
| `src/components/projects/ProjectChatWidget.tsx` | Hook + Sidebar integrieren, /clear, Laden/Speichern |

## 5. Ablauf

```text
User oeffnet Chat-Widget:
  1. useChatSessions laedt alle Sessions fuer context_type + context_id
  2. Letzte Session wird automatisch geladen (oder neue angelegt)
  3. Nachrichten aus DB werden angezeigt

User chattet:
  1. Nachricht wird gesendet + gestreamt (wie bisher)
  2. Nach jeder vollstaendigen Antwort: messages werden in DB gespeichert
  3. Titel wird aus erster User-Nachricht generiert (falls noch kein Titel)

User tippt "/clear":
  1. Aktuelle Session wird aus DB geloescht
  2. Neue leere Session wird angelegt
  3. Chat wird zurueckgesetzt

User klickt "Neuer Chat":
  1. Neue leere Session in DB anlegen
  2. Als aktive Session setzen
  3. Chat-Bereich leeren

User klickt auf alten Chat in der Sidebar:
  1. Messages aus der Session laden
  2. Als aktive Session setzen
  3. Chat-Bereich mit gespeicherten Nachrichten fuellen
```

## 6. Technische Details

- Titel-Generierung: `messages[0].content.slice(0, 40)` + "..." (rein clientseitig, kein AI-Call)
- Speicherung: Nach jedem vollstaendigen Stream-Durchlauf wird die Session mit dem aktuellen messages-Array upgedated
- Die Sidebar zeigt maximal die letzten 20 Sessions, sortiert nach `updated_at DESC`
- Keine Datenbank-Aenderungen an bestehenden Tabellen noetig

