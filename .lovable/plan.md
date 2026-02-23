

# Risiko 2: Browser-Kompatibilitaet der Speech Recognition absichern

## Problem

Die Web Speech API (`webkitSpeechRecognition`) wird nur von Chrome und Edge unterstuetzt. In Firefox und Safari:
- Der Notetaker startet die Aufnahme, aber die Spracherkennung schlaegt still fehl
- Der Benutzer bekommt kein Transkript, ohne zu verstehen warum
- Die `VoiceInputButton` versteckt sich komplett -- kein Hinweis fuer den Benutzer

Zusaetzlich gibt es einen Bug im `onresult`-Handler: Er sammelt ALLE bisherigen Ergebnisse bei jedem Event, statt nur neue hinzuzufuegen. Das fuehrt zu doppeltem Text im Transkript.

## Aenderungen

### 1. `src/hooks/useSpeechRecognition.ts` -- Robuster machen

- **onresult-Bug fixen**: Nur neue Ergebnisse seit dem letzten Event verarbeiten (Index-Tracking mit `event.resultIndex`)
- **Fehlerbehandlung erweitern**: `network`, `audio-capture`, `aborted` und `service-not-available` Fehler abfangen und verstaendliche Meldungen ausgeben
- **`isActive`-State** hinzufuegen: Zeigt ob die Recognition tatsaechlich laeuft (nicht nur angefragt wurde)

### 2. `src/components/MeetingNoteTaker.tsx` -- Warnung bei fehlendem Support

- Beim Start der Aufnahme pruefen ob `isSupported === false`
- Falls nicht unterstuetzt: Aufnahme trotzdem starten (Audio wird aufgenommen), aber einen Warnhinweis anzeigen:
  "Echtzeit-Transkription ist in diesem Browser nicht verfuegbar. Audio wird trotzdem aufgenommen und kann spaeter transkribiert werden."
- Damit funktioniert die Aufnahme in allen Browsern, nur das Live-Transkript fehlt

### 3. `src/components/ui/VoiceInputButton.tsx` -- Sichtbar bleiben mit Hinweis

- Statt den Button komplett zu verstecken wenn `!isSupported`, den Button deaktiviert anzeigen mit Tooltip:
  "Spracheingabe wird nur in Chrome und Edge unterstuetzt"
- Damit weiss der Benutzer, dass die Funktion existiert, aber nicht verfuegbar ist

### 4. `src/components/meeting/RecordView.tsx` -- Browser-Kompatibilitaets-Banner

- Wenn `!isSupported`: Info-Banner oberhalb der Aufnahme-Steuerung anzeigen
- Text: "Dein Browser unterstuetzt keine Echtzeit-Transkription. Verwende Chrome oder Edge fuer Live-Transkripte, oder nimm auf -- die Transkription erfolgt nach dem Upload."

## Technische Details

### onresult-Bug Fix (vorher vs. nachher)

```text
VORHER (fehlerhaft):
- Event 1: results = ["Hallo"] -> callback("Hallo")
- Event 2: results = ["Hallo", "Welt"] -> callback("Hallo Welt")  // "Hallo" wird doppelt

NACHHER (korrekt):
- Event 1: resultIndex=0, results[0] = "Hallo" -> callback("Hallo")
- Event 2: resultIndex=1, results[1] = "Welt" -> callback("Hallo Welt")  // Nur neue ab resultIndex
```

### Erweiterte Fehlerbehandlung

```text
'not-allowed'       -> Mikrofon-Zugriff verweigert
'audio-capture'     -> Kein Mikrofon gefunden
'network'           -> Netzwerkfehler bei der Spracherkennung
'service-not-available' -> Spracherkennungsdienst nicht erreichbar
'aborted'           -> Spracherkennung wurde unterbrochen (kein Fehler anzeigen)
'no-speech'         -> Ignorieren, weiter warten
```

## Was sich NICHT aendert

- Die Aufnahme-Logik (MediaRecorder) funktioniert bereits in allen Browsern
- Der Audio-Upload und die Backend-Transkription bleiben unberuehrt
- Die Quick-Recording-Funktion ist nicht betroffen (nutzt keine Speech Recognition)

