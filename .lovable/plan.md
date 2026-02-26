

# Rechtlicher Hinweis vor Aufnahmestart

## Anforderung

Bevor die Aufnahme tatsaechlich startet (also bevor `getDisplayMedia` und `getUserMedia` aufgerufen werden), soll ein **verpflichtender Hinweis-Dialog** erscheinen, der den User darauf aufmerksam macht, dass er seine Gespraechspartner ueber die Aufnahme informieren muss. Ohne Bestaetigung darf die Aufnahme nicht starten.

## Umsetzung

### RecordingModeDialog anpassen

Der Klick auf einen Aufnahmemodus (z.B. "Gesamter Bildschirm") startet die Aufnahme **nicht sofort**, sondern oeffnet einen Zwischen-Dialog (AlertDialog) mit folgendem Inhalt:

```text
┌──────────────────────────────────────────────┐
│  ⚠️  Aufnahmehinweis                         │
│                                              │
│  Sie sind gesetzlich verpflichtet, alle      │
│  Gesprächsteilnehmer vor Beginn der          │
│  Aufnahme darüber zu informieren, dass       │
│  das Gespräch aufgezeichnet wird.            │
│                                              │
│  Eine Aufnahme ohne Zustimmung aller         │
│  Beteiligten ist nicht rechtmäßig.           │
│                                              │
│  [ Abbrechen ]   [ Verstanden & Starten ]    │
└──────────────────────────────────────────────┘
```

### Ablauf

1. User klickt auf Modus-Button (z.B. "Gesamter Bildschirm")
2. Statt `startRecording()` wird ein lokaler State `pendingMode` gesetzt und der Consent-Dialog geoeffnet
3. User klickt "Verstanden & Starten" → `startRecording(pendingMode, includeWebcam)` wird aufgerufen
4. User klickt "Abbrechen" → Dialog schliesst, nichts passiert

### Betroffene Datei

| Datei | Aenderung |
|---|---|
| `src/components/recording/RecordingModeDialog.tsx` | Neuer lokaler State `pendingMode` und `showConsent`. AlertDialog mit rechtlichem Hinweis. Modus-Buttons setzen nur `pendingMode` statt direkt zu starten. Bestaetigung ruft `startRecording` auf. |

### Technische Details

- Verwendet den bestehenden `AlertDialog` aus `@/components/ui/alert-dialog`
- Der Consent-Dialog wird als `AlertDialog` (nicht dismissable durch Klick ausserhalb) implementiert, damit der User bewusst bestaetigen muss
- Kein Backend noetig, rein clientseitige Logik
- Der Popover schliesst sich beim Oeffnen des Consent-Dialogs (da `startRecording` intern `setShowModeDialog(false)` aufruft — hier wird stattdessen der Popover manuell geschlossen bevor der AlertDialog erscheint)

