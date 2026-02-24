

# Umstellung auf eigenen Anthropic API Key

## Uebersicht

7 Edge Functions nutzen aktuell den Lovable AI Gateway (`ai.gateway.lovable.dev`) mit dem `LOVABLE_API_KEY`. Diese werden auf die Anthropic Messages API (`api.anthropic.com`) umgestellt, sodass du volle Kontrolle ueber Kosten und Rate Limits hast.

## Schritt 1: API Key sicher speichern

Du wirst aufgefordert, deinen Anthropic API Key einzugeben. Dieser wird als `ANTHROPIC_API_KEY` sicher in deinem Backend gespeichert und ist nur fuer die Edge Functions zugaenglich.

Den API Key findest du unter: https://console.anthropic.com/settings/keys

## Schritt 2: Alle 7 Edge Functions umstellen

Jede Funktion wird von der OpenAI-kompatiblen Gateway-API auf die Anthropic Messages API umgestellt.

**Betroffene Funktionen:**

| Funktion | Zweck |
|---|---|
| `analyze-transcript` | Automatische Meeting-Analyse (Summary, Key Points, Action Items) |
| `analyze-notetaker` | Notetaker-Analyse |
| `analyze-project` | Projekt-uebergreifende Analyse |
| `meeting-chat` | Chat ueber alle Meetings |
| `single-meeting-chat` | Chat ueber ein einzelnes Meeting |
| `edit-email-ai` | KI-gestuetzte E-Mail-Bearbeitung |
| `project-chat` | Projekt-Chat-Assistent |

### Technische Aenderungen pro Funktion

**API-Endpunkt:**
```text
Vorher:  https://ai.gateway.lovable.dev/v1/chat/completions
Nachher: https://api.anthropic.com/v1/messages
```

**Headers:**
```text
Vorher:  Authorization: Bearer ${LOVABLE_API_KEY}
Nachher: x-api-key: ${ANTHROPIC_API_KEY}
         anthropic-version: 2023-06-01
```

**Request-Format:**
```text
Vorher (OpenAI-kompatibel):
{
  model: "google/gemini-3-flash-preview",
  messages: [
    { role: "system", content: "..." },
    { role: "user", content: "..." }
  ]
}

Nachher (Anthropic Messages API):
{
  model: "claude-sonnet-4-20250514",
  max_tokens: 4096,
  system: "...",
  messages: [
    { role: "user", content: "..." }
  ]
}
```

**Response-Format:**
```text
Vorher:  data.choices[0].message.content
Nachher: data.content[0].text
```

**Streaming (fuer Chat-Funktionen):**
```text
Vorher:  stream: true (OpenAI SSE-Format)
Nachher: stream: true (Anthropic SSE-Format mit event: content_block_delta)
```

### Modell-Zuordnung

| Bisheriges Modell | Neues Modell | Einsatz |
|---|---|---|
| google/gemini-3-flash-preview | claude-sonnet-4-20250514 | Chat, E-Mail, Notetaker, Projekt-Analyse |
| google/gemini-2.5-flash | claude-sonnet-4-20250514 | Transkript-Analyse |

Claude Sonnet 4 bietet ein gutes Verhaeltnis von Qualitaet, Geschwindigkeit und Kosten. Falls gewuenscht, kann auch Claude Haiku (guenstiger/schneller) oder Claude Opus (leistungsstaerker) gewaehlt werden.

## Schritt 3: Streaming-Format anpassen

Die 3 Chat-Funktionen (`meeting-chat`, `single-meeting-chat`, `project-chat`) nutzen Streaming. Das Anthropic SSE-Format unterscheidet sich vom OpenAI-Format:

```text
Anthropic SSE Events:
  event: message_start
  event: content_block_start
  event: content_block_delta    <- hier kommt der Text
  event: content_block_stop
  event: message_stop

Die Edge Functions werden den Anthropic-Stream in das OpenAI-kompatible Format
umwandeln, sodass das Frontend NICHT geaendert werden muss.
```

## Zusammenfassung

| Was | Aenderung |
|---|---|
| Neues Secret | `ANTHROPIC_API_KEY` hinzufuegen |
| 7 Edge Functions | API-Endpunkt, Headers, Request/Response-Format anpassen |
| Frontend | Keine Aenderungen noetig (Stream-Format wird im Backend konvertiert) |
| Bisheriger LOVABLE_API_KEY | Bleibt bestehen, wird aber von diesen Funktionen nicht mehr genutzt |

