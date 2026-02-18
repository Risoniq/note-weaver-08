
# Dropdown-Menue zum Zuordnen von Meetings

## Problem
Aktuell oeffnet sich ein separater Dialog zum Zuordnen von Meetings. Gewuenscht ist stattdessen ein Dropdown-Menue direkt auf der Projektseite, ueber das man schnell alle verfuegbaren Meetings des Accounts sehen und zuordnen kann.

## Loesung

### Aenderung: `AssignRecordingsDialog.tsx` durch Dropdown-Komponente ersetzen

Die bestehende Dialog-Komponente wird durch ein Popover mit Suchfeld und scrollbarer Meeting-Liste ersetzt. Das Popover oeffnet sich direkt beim Klick auf den Button, ohne separaten Dialog.

**Datei:** `src/components/projects/AssignRecordingsDialog.tsx`

Umstellung von `Dialog` auf `Popover` (aus den bereits vorhandenen UI-Komponenten):

- Button "Meetings zuordnen" oeffnet ein Popover-Dropdown
- Oben im Popover: Suchfeld zum Filtern
- Darunter: scrollbare Liste aller abgeschlossenen Meetings des Accounts (die noch nicht zugeordnet sind)
- Klick auf ein Meeting ordnet es sofort dem Projekt zu
- Bereits zugeordnete Meetings werden ausgeblendet
- Die bestehende Query und Zuordnungs-Logik bleibt identisch

### Technische Details

- Komponente nutzt `Popover` und `PopoverContent` aus `@/components/ui/popover`
- `PopoverContent` mit `w-96` Breite und `max-h-[60vh]` fuer scrollbare Liste
- Suchfeld (`Input`) bleibt oben fixiert
- Meeting-Eintraege mit Titel, Datum und Zuordnungs-Button (Checkbox-Icon)
- Keine Aenderungen an der Datenbank oder anderen Dateien noetig
