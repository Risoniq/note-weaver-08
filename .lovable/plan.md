

## Buttons verschieben: Share und Loeschen aus Header entfernen, Share in Toolbar

### Aenderungen

**Datei: `src/pages/MeetingDetail.tsx`**

1. **Header-Bereich (Zeilen 818-837)**: Die beiden Buttons "Meeting teilen" (Share2) und "Meeting loeschen" (Trash2) werden komplett aus dem Header entfernt. Dort bleibt nur der Status-Badge und der Aktualisieren-Button.

2. **Transkript-Toolbar (Zeilen 1048-1068)**: Der Share-Button wird zwischen "Transkript neu laden" und "Bericht herunterladen" eingefuegt. Die Toolbar bekommt dann drei Buttons:
   - Transkript neu laden (links)
   - Meeting teilen (Mitte/rechts)
   - Bericht herunterladen (rechts)

3. **Loeschen-Button**: Wird ebenfalls in die Toolbar verschoben (ganz rechts), damit er weiterhin erreichbar ist, aber nicht prominent im Header steht.

### Technische Details

| Datei | Aenderung |
|-------|-----------|
| `src/pages/MeetingDetail.tsx` | Share + Delete Buttons aus Header entfernen (Zeilen 818-837), Share Button in Transkript-Toolbar einfuegen (nach Zeile 1058) |

Keine weiteren Dateien betroffen.

