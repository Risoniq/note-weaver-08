
# Plan: Speech-to-Text für Chat-Widgets

## Übersicht

Eine Mikrofon-Taste wird zu beiden Chat-Widgets (Meeting-Chat und Account-Chat) hinzugefügt, mit der Nutzer per Sprache Fragen stellen können. Die Transkription erfolgt über die **Browser Web Speech API**, die bereits im Projekt implementiert ist.

## Warum nicht Recall.ai?

Recall.ai ist für Meeting-Recordings konzipiert und bietet keine API für kurze Audio-Uploads. Für Chat-Eingaben ist die Browser-native Lösung ideal:
- Kostenlos und ohne zusätzliche API-Keys
- Niedrige Latenz (Echtzeit)
- Funktioniert in Chrome, Edge und Safari

## Funktionsweise

1. Nutzer klickt auf Mikrofon-Symbol neben dem Eingabefeld
2. Browser fragt nach Mikrofon-Berechtigung (einmalig)
3. Sprache wird in Echtzeit transkribiert
4. Text erscheint im Eingabefeld
5. Nutzer kann Text vor dem Absenden bearbeiten oder direkt senden

## Änderungen

### 1. VoiceInputButton Komponente

Neue wiederverwendbare Komponente für Spracheingabe:

| Feature | Beschreibung |
|---------|--------------|
| Mikrofon-Toggle | Klick startet/stoppt Aufnahme |
| Visuelles Feedback | Pulsierende Animation während Aufnahme |
| Auto-Stop | Automatischer Stop nach 30 Sekunden |
| Fehler-Handling | Toast bei fehlender Browser-Unterstützung |

```text
┌─────────────────────────────────────────────┐
│ Frag etwas über dieses Meeting...    🎤  ➤ │
└─────────────────────────────────────────────┘
                                       ↑
                              Mikrofon-Button
```

### 2. Anpassung MeetingChatWidget (Meeting-Ebene)

Datei: `src/components/meeting/MeetingChatWidget.tsx`

- Import VoiceInputButton
- State für Spracheingabe
- Integration in Formular neben Send-Button
- Transkribierter Text wird in Input-Feld eingefügt

### 3. Anpassung MeetingChatWidget (Dashboard-Ebene)

Datei: `src/components/dashboard/MeetingChatWidget.tsx`

- Gleiche Änderungen wie Meeting-Chat
- Konsistente UX über beide Chat-Interfaces

## Benutzeroberfläche

```text
Vorher:
┌────────────────────────────────┬───┐
│ Eingabefeld                    │ ➤ │
└────────────────────────────────┴───┘

Nachher:
┌────────────────────────────────┬───┬───┐
│ Eingabefeld                    │🎤 │ ➤ │
└────────────────────────────────┴───┴───┘
                                  │
                                  └── Rot pulsierend wenn aktiv
```

## Technische Details

### VoiceInputButton Props

| Prop | Typ | Beschreibung |
|------|-----|--------------|
| onTranscript | (text: string) => void | Callback mit erkanntem Text |
| disabled | boolean | Deaktiviert während Chat lädt |
| className | string | Optionale CSS-Klassen |

### Verwendeter Hook

Der existierende `useSpeechRecognition` Hook wird genutzt:
- `isSupported`: Browser-Check
- `startRecognition()`: Aufnahme starten
- `stopRecognition()`: Aufnahme stoppen
- `setOnResult(callback)`: Text-Callback setzen

### Browser-Unterstützung

| Browser | Unterstützt |
|---------|-------------|
| Chrome | ✅ Ja |
| Edge | ✅ Ja |
| Safari | ✅ Ja (ab 14.1) |
| Firefox | ❌ Nein |

Bei nicht unterstützten Browsern wird der Button ausgeblendet.

## Dateien

| Datei | Aktion |
|-------|--------|
| `src/components/ui/VoiceInputButton.tsx` | Neu erstellen |
| `src/components/meeting/MeetingChatWidget.tsx` | Erweitern |
| `src/components/dashboard/MeetingChatWidget.tsx` | Erweitern |

## Ergebnis

- Beide Chat-Widgets bekommen Spracheingabe-Funktion
- Nutzer können per Sprache Fragen stellen
- Kostenlose Lösung ohne zusätzliche API-Keys
- Konsistente UX in der gesamten App
