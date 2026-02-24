

# Abstand zwischen Chat-Fenstern einbauen

## Problem
Die Chat-Sidebar und der Chat-Bereich liegen optisch zu eng beieinander (gap-0), und die Abschnitte innerhalb der Chat-Widgets haben zu wenig Abstand.

## Loesung
In allen drei Chat-Widgets den Abstand zwischen Sidebar und Chat-Bereich erhoehen und die Widgets insgesamt mit mehr Innenabstand versehen:

### Aenderungen

| Datei | Aenderung |
|---|---|
| `src/components/projects/ProjectChatWidget.tsx` | `gap-0` zu `gap-3` aendern, aeusseren Container mit `rounded-xl p-4 bg-muted` umschliessen (wie die anderen Widgets) |
| `src/components/meeting/MeetingChatWidget.tsx` | `gap-0` zu `gap-3` aendern |
| `src/components/dashboard/MeetingChatWidget.tsx` | `gap-0` zu `gap-3` aendern |
| `src/components/chat/ChatHistorySidebar.tsx` | Rechten Border-Stil beibehalten, aber etwas Abstand nach rechts (`mr-1`) hinzufuegen |

Drei kleine einzeilige Aenderungen pro Widget-Datei, keine strukturellen Umbauten noetig.

