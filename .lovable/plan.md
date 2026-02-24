
# Chat-Sidebar standardmaessig einblenden

## Problem
In allen drei Chat-Widgets ist `sidebarOpen` auf `false` initialisiert. Die Sidebar wird erst sichtbar, wenn man manuell auf das History-Icon klickt.

## Loesung
In allen drei Dateien den Initialwert von `useState(false)` auf `useState(true)` aendern:

| Datei | Zeile | Aenderung |
|---|---|---|
| `src/components/dashboard/MeetingChatWidget.tsx` | 17 | `useState(false)` -> `useState(true)` |
| `src/components/meeting/MeetingChatWidget.tsx` | 33 | `useState(false)` -> `useState(true)` |
| `src/components/projects/ProjectChatWidget.tsx` | 22 | `useState(false)` -> `useState(true)` |

Keine weiteren Aenderungen noetig. Die Sidebar kann weiterhin per Toggle-Button ein-/ausgeklappt werden.
