
# Einheitliches Design fuer "Projekt zuordnen" und "Mit Team teilen"

## Problem
Beide Elemente verwenden aktuell die Standard-Farben ihrer Komponenten, die zu einem blassen/grauen Text fuehren. Sie sollen stattdessen `text-foreground` verwenden (schwarz im Light-Mode, weiss im Dark-Mode), passend zur Ueberschrift.

## Aenderungen

### 1. ProjectAssignment.tsx (Zeile 84)
- SelectTrigger: Klasse `text-foreground` hinzufuegen, damit der Placeholder-Text "Projekt zuordnen..." in schwarz/weiss erscheint.

### 2. TeamShareDropdown.tsx (Zeile 162 + 183)
- Users-Icon: Farbe von `text-muted-foreground` auf `text-foreground` aendern (wie beim FolderKanban-Icon).
- Button "Mit Team teilen...": Klasse `text-foreground` hinzufuegen fuer einheitlichen Kontrast.

## Technische Details

| Datei | Zeile | Aenderung |
|---|---|---|
| `src/components/meeting/ProjectAssignment.tsx` | 84 | `className="h-7 w-auto min-w-[140px] text-xs border-dashed text-foreground"` |
| `src/components/meeting/TeamShareDropdown.tsx` | 162 | `text-muted-foreground` ersetzen durch `text-foreground` |
| `src/components/meeting/TeamShareDropdown.tsx` | 183 | `className="h-7 text-xs border-dashed gap-1 text-foreground"` |

Keine neuen Abhaengigkeiten oder Datenbankänderungen noetig.
