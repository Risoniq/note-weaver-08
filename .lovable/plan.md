
# Plan: Admin-Funktion zum Anlegen von Meetings und Transkript-Upload

## Übersicht

Als Admin möchtest du Meetings für beliebige Benutzer-Accounts anlegen und manuell Transkripte hochladen können, die dann automatisch analysiert werden (Titel, Zusammenfassung, Key Points, Action Items).

## Architektur

```text
┌─────────────────────────────────────────────────────────────┐
│                     Admin Dashboard                          │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  [+ Meeting für Benutzer anlegen]   Button im Header    ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Dialog: Meeting anlegen                                     │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Benutzer auswählen:  [Dropdown mit allen Usern]         ││
│  │ Meeting-Titel:       [___________________________]      ││
│  │ Transkript:          [Datei hochladen (.txt)]           ││
│  │                      ODER                                ││
│  │                      [Textarea für direkten Text]       ││
│  │ Meeting-Datum:       [Datepicker - optional]            ││
│  │                                                          ││
│  │              [Abbrechen]  [Meeting anlegen]             ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Edge Function: admin-create-meeting                         │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 1. Admin-Berechtigung prüfen (has_role)                 ││
│  │ 2. Recording in DB erstellen mit target_user_id         ││
│  │ 3. analyze-transcript aufrufen                          ││
│  │ 4. Erfolg zurückmelden                                  ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Ergebnis: Neues Meeting im Account des Benutzers           │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ • Titel (generiert oder manuell)                        ││
│  │ • Zusammenfassung                                       ││
│  │ • Key Points                                            ││
│  │ • Action Items                                          ││
│  │ • Wortanzahl                                            ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Umsetzungsschritte

### Schritt 1: Edge Function erstellen

Neue Datei: `supabase/functions/admin-create-meeting/index.ts`

Diese Edge Function wird:
- Admin-Berechtigung via `has_role()` prüfen
- Ein neues Recording in der `recordings`-Tabelle erstellen
- Das Transkript in `transcript_text` speichern
- Die `analyze-transcript` Edge Function aufrufen
- Den Status auf "done" setzen nach erfolgreicher Analyse

Erwartete Request-Parameter:
```typescript
{
  target_user_id: string;      // UUID des Ziel-Benutzers
  title?: string;              // Optionaler Titel (sonst KI-generiert)
  transcript_text: string;     // Das Transkript als Text
  meeting_date?: string;       // ISO-Datum (optional, sonst jetzt)
  duration?: number;           // Dauer in Sekunden (optional)
}
```

### Schritt 2: Admin-Dialog-Komponente erstellen

Neue Datei: `src/components/admin/AdminCreateMeetingDialog.tsx`

Der Dialog enthält:
- Benutzer-Dropdown (lädt alle User aus dem Admin-Dashboard)
- Titel-Eingabefeld (optional, wird von KI generiert wenn leer)
- Transkript-Input mit zwei Modi:
  - Datei-Upload (.txt)
  - Textarea für direkten Text-Input
- Optionales Datum-Picker
- Optionale Dauer-Eingabe

### Schritt 3: Admin Dashboard erweitern

Datei: `src/pages/Admin.tsx`

Änderungen:
- Button "+ Meeting anlegen" im Header neben der Zurück-Taste
- Integration des `AdminCreateMeetingDialog`
- State für Dialog-Steuerung

### Schritt 4: Supabase Config aktualisieren

Datei: `supabase/config.toml`

Neue Edge Function registrieren:
```toml
[functions.admin-create-meeting]
verify_jwt = false
```

## Betroffene Dateien

| Datei | Aktion |
|-------|--------|
| `supabase/functions/admin-create-meeting/index.ts` | Neu erstellen |
| `src/components/admin/AdminCreateMeetingDialog.tsx` | Neu erstellen |
| `src/pages/Admin.tsx` | Button und Dialog hinzufügen |
| `supabase/config.toml` | Edge Function registrieren |

## Technische Details

### Edge Function: admin-create-meeting

```typescript
// Hauptlogik
1. Auth-Header validieren
2. Admin-Rolle prüfen via has_role()
3. Validierung: target_user_id und transcript_text erforderlich
4. Recording erstellen:
   - meeting_id: crypto.randomUUID()
   - user_id: target_user_id
   - status: 'processing'
   - transcript_text: transcript_text
   - title: title || null (wird von Analyse gesetzt)
   - source: 'admin_upload'
   - created_at: meeting_date || now()
5. analyze-transcript aufrufen mit recording_id
6. Status auf 'done' setzen
7. Erfolg zurückmelden mit recording.id
```

### Dialog-Komponente

```typescript
// States
- selectedUserId: string
- title: string
- transcriptText: string
- transcriptFile: File | null
- meetingDate: Date
- duration: number
- isLoading: boolean

// Funktionen
- handleFileUpload: Datei lesen und Text extrahieren
- handleSubmit: Edge Function aufrufen
- resetForm: Formular zurücksetzen
```

### Validierung

- Transkript muss mindestens 100 Zeichen haben
- Benutzer muss ausgewählt sein
- Maximal 500.000 Zeichen für Transkript (Performance)

## Sicherheit

- Nur Admins können diese Funktion nutzen
- Admin-Check erfolgt serverseitig via `has_role()`
- Transkript wird sanitized (keine Script-Injection)
- Rate-Limiting durch Supabase Functions

## Benutzeroberfläche

Der Button wird rechts neben dem Header platziert:

```
[←] Admin Dashboard                    [+ Meeting anlegen]
    Benutzerübersicht und Statistiken
```

Nach erfolgreichem Anlegen:
- Toast-Nachricht "Meeting erfolgreich angelegt"
- Optional: Direkt zum Meeting navigieren oder Dialog schließen
- Benutzer-Liste wird aktualisiert (Recordings-Count erhöht sich)

## Nach der Implementierung

1. Im Admin Dashboard auf "+ Meeting anlegen" klicken
2. Benutzer aus der Liste auswählen
3. Transkript einfügen oder Datei hochladen
4. Optional: Titel und Datum setzen
5. "Meeting anlegen" klicken
6. KI analysiert das Transkript automatisch
7. Meeting erscheint im Dashboard des gewählten Benutzers
