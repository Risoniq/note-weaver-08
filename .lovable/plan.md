

# Bericht-Einstellungen und E-Mail-KI-Bearbeitung

## Uebersicht

Der Benutzer moechte folgende drei Funktionen:
1. **KI-gestuetzte E-Mail-Bearbeitung** (mit Claude/Lovable AI)
2. **"Transkript neu laden" Button ueber dem Transkript** 
3. **"Download Bericht" Button** mit einem Einstellungs-Layer (fuer Admin-Zwecke)

---

## 1. E-Mail mit KI bearbeiten

### Aktuelle Situation
Die Follow-Up E-Mail wird in der rechten Spalte angezeigt und kann nur kopiert werden.

### Neue Funktion
Ein "Mit KI bearbeiten" Button oeffnet ein Modal, in dem der Benutzer:
- Die generierte E-Mail sieht
- Anweisungen eingeben kann (z.B. "Mache die E-Mail formeller" oder "Fuege Deadline fuer To-Dos hinzu")
- Die KI-generierte verbesserte Version erhaelt

### Technische Umsetzung

**Neue Edge Function:** `supabase/functions/edit-email-ai/index.ts`
- Nimmt die aktuelle E-Mail und Benutzeranweisungen entgegen
- Verwendet Lovable AI (google/gemini-3-flash-preview) fuer die Bearbeitung
- Gibt die ueberarbeitete E-Mail zurueck

**Neue Komponente:** `src/components/meeting/EmailEditModal.tsx`
- Modal mit Textarea fuer Anweisungen
- Vorschau der aktuellen und neuen E-Mail
- "Uebernehmen" und "Abbrechen" Buttons

**Aenderung:** `src/pages/MeetingDetail.tsx`
- Neuer State fuer E-Mail-Bearbeitung
- Button "Mit KI bearbeiten" neben dem "E-Mail kopieren" Button
- Integration des Modals

---

## 2. "Transkript neu laden" Button ueber dem Transkript

### Aktuelle Situation
Der Button befindet sich im Header der Seite (oben rechts neben dem Status-Badge).

### Neue Platzierung
Der Button wird zusaetzlich direkt ueber dem Transkript-Card angezeigt, zusammen mit dem "Download Bericht" Button.

### Technische Umsetzung

**Aenderung:** `src/pages/MeetingDetail.tsx`
- Neue Button-Leiste oberhalb des Transkript-Cards
- Enthaelt "Transkript neu laden" und "Download Bericht" Buttons
- Wird nur angezeigt wenn `recording.transcript_text` existiert

---

## 3. "Download Bericht" mit Einstellungs-Layer

### Funktion
Ein Button der ein Modal oeffnet mit konfigurierbaren Export-Optionen:

**Konfigurationsoptionen:**
- Dateiformat: TXT, Markdown, PDF (zukuenftig)
- Inhalt auswaehlen:
  - Zusammenfassung
  - Key Points
  - Action Items
  - Vollstaendiges Transkript
  - Teilnehmerliste
- E-Mail-Vorlage einbeziehen
- Sprache der Ausgabe

**Admin-Only Optionen (spaeter ausblendbar):**
- Metadaten einbeziehen (IDs, Timestamps)
- Debug-Informationen
- Rohformat der Daten

### Technische Umsetzung

**Neue Komponente:** `src/components/meeting/ReportDownloadModal.tsx`
- Modal mit Checkboxen fuer Inhaltsauswahl
- Format-Dropdown
- Admin-Bereich (kann spaeter mit Feature-Flag ausgeblendet werden)
- Generiert und downloadet den Bericht

**Aenderung:** `src/pages/MeetingDetail.tsx`
- State fuer Modal-Sichtbarkeit
- Button "Download Bericht" in der Transkript-Leiste

---

## Betroffene Dateien

| Datei | Aenderung |
|-------|-----------|
| `supabase/functions/edit-email-ai/index.ts` | Neue Edge Function fuer KI-E-Mail-Bearbeitung |
| `src/components/meeting/EmailEditModal.tsx` | Neues Modal fuer E-Mail-Bearbeitung mit KI |
| `src/components/meeting/ReportDownloadModal.tsx` | Neues Modal fuer Bericht-Einstellungen |
| `src/pages/MeetingDetail.tsx` | Integration beider Modals und Button-Platzierung |
| `supabase/config.toml` | Edge Function Konfiguration |

---

## UI-Layout Aenderungen

### Aktuelle Struktur (Header):
```text
[<] Meeting Titel                     [Transkript neu laden] [Status]
```

### Neue Struktur (ueber Transkript-Card):
```text
+--------------------------------------------------------+
| [RefreshCw] Transkript neu laden    [Download] Bericht |
+--------------------------------------------------------+
| Transkript                                             |
| [Quality Banner]                                       |
| [Transkript Inhalt...]                                 |
+--------------------------------------------------------+
```

### Neue E-Mail Sektion:
```text
+----------------------------------+
| Follow-Up E-Mail                 |
+----------------------------------+
| [E-Mail Vorschau]                |
+----------------------------------+
| [Mit KI bearbeiten] [Kopieren]   |
+----------------------------------+
```

---

## Edge Function: edit-email-ai

```typescript
// Verwendet Lovable AI fuer E-Mail-Bearbeitung
// Input: { email: string, instructions: string, recording_context: {...} }
// Output: { edited_email: string }

const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "google/gemini-3-flash-preview",
    messages: [
      { role: "system", content: "Du bist ein professioneller E-Mail-Assistent..." },
      { role: "user", content: `Bearbeite diese E-Mail: ${email}\n\nAnweisungen: ${instructions}` }
    ],
    stream: false,
  }),
});
```

---

## Feature-Flag fuer Admin-Optionen

Um die Admin-Optionen spaeter auszublenden:

```typescript
// In ReportDownloadModal.tsx
const isAdmin = true; // Spaeter: useAdminCheck() oder Feature-Flag

{isAdmin && (
  <div className="border-t pt-4 mt-4">
    <p className="text-sm font-medium text-muted-foreground mb-2">
      Erweiterte Optionen (Admin)
    </p>
    {/* Admin-only Optionen */}
  </div>
)}
```

