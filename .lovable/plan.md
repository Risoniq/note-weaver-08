
# Transkript-Sprecheridentifikation verbessern

## Problem-Analyse

Aktuell zeigen alle Transkripte nur "Unbekannt" als Sprecher, obwohl die `sync-recording` Funktion bereits versucht, Teilnehmernamen von Recall.ai zu holen. Die Datenbankabfrage zeigt:
- `participants`: NULL für alle Recordings
- `calendar_attendees`: NULL für alle Recordings

## Ursachen

1. **Recall.ai liefert Sprechernamen nur unter bestimmten Bedingungen:**
   - MS Teams: Erfordert Enterprise-Konfiguration und Bot-Zulassung
   - Zoom: Teilnehmernamen werden oft anonymisiert
   - Google Meet: Benötigt spezielle Berechtigungen

2. **Das Mapping funktioniert nicht richtig:** Die `speaker_timeline` enthält IDs, aber das Mapping zu echten Namen scheitert, weil `meeting_participants` leer ist

3. **Kalender-Teilnehmer werden nicht abgerufen:** Das Meeting muss mit einem Kalender-Event verknüpft sein, damit `calendar_attendees` befüllt wird

## Lösungsansatz (mehrstufig)

### Phase 1: Verbesserung der Recall.ai-Datenextraktion

**Datei: `supabase/functions/sync-recording/index.ts`**

- Erweiterte Logik für `speaker_timeline`: Nutze `user.name` direkt aus jedem Entry
- Fallback auf `platform_user_id` als lesbaren Namen (bei MS Teams oft der UPN/E-Mail)
- Speichere alle gefundenen Speaker-Daten in `participants`, auch wenn sie generisch sind

### Phase 2: Alternative Sprecheridentifikation im Frontend

**Datei: `src/pages/MeetingDetail.tsx`**

- **Voice-Pattern-basierte Unterscheidung**: Automatisches Nummerieren bleibt, aber mit verbesserter Logik
- **Verbesserte UI für manuelle Zuordnung**: 
  - Zeige geschätzte Sprecherzahl basierend auf Gesprächsmustern
  - Ermögliche Schnellzuordnung über Keyboard-Shortcuts
  - Speichere Sprechernamen pro User für zukünftige Vorschläge

### Phase 3: Historische Sprechernamen-Datenbank (optional)

**Neue Tabelle: `speaker_names`**

Speichert zugeordnete Sprechernamen pro User, um bei zukünftigen Meetings automatisch Vorschläge zu machen basierend auf häufig verwendeten Namen.

---

## Technische Änderungen

### 1. sync-recording Edge Function verbessern

| Änderung | Beschreibung |
|----------|--------------|
| Erweiterte speaker_timeline Auswertung | Nutze alle verfügbaren Felder: `user.name`, `user.platform_user_id`, `user.identifier` |
| Platform-ID als Fallback-Name | Bei MS Teams oft lesbar (z.B. "Max.Mustermann@company.com") |
| Verbesserte Logging | Detaillierte Logs um zu verstehen, was Recall.ai zurückgibt |
| Kalender-API direkter Abruf | Falls bot_id vorhanden, hole calendar_attendees aktiv |

### 2. MeetingDetail.tsx Frontend-Verbesserungen

| Änderung | Beschreibung |
|----------|--------------|
| Sprecheranalyse verbessern | Nutze Gesprächsmuster (Pausen, Antwortreihenfolge) zur Unterscheidung |
| Schnellaktionen | "Alle umbenennen" für Pattern wie "Sprecher 1" → Name |
| Lokale Namenshistorie | Speichere zugeordnete Namen im localStorage für Vorschläge |
| Visuelle Sprecherfarben | Jeder Sprecher erhält eine konsistente Farbe im Transkript |

### 3. Neue Tabelle für Sprechervorschläge

```sql
CREATE TABLE speaker_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  usage_count INTEGER DEFAULT 1,
  last_used_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: User sieht nur eigene Vorschläge
ALTER TABLE speaker_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own suggestions" 
ON speaker_suggestions FOR ALL 
USING (auth.uid() = user_id);
```

---

## Implementierungs-Reihenfolge

1. **Sofort wirksam:** 
   - Verbessere `sync-recording` um mehr Daten zu extrahieren
   - Füge Logging hinzu um Recall.ai-Responses zu analysieren

2. **Frontend-Verbesserungen:**
   - Lokale Namensvorschläge basierend auf bisherigen Zuordnungen
   - Verbesserte Sprecher-Badge-UI mit Farben

3. **Datenbank-Erweiterung:**
   - `speaker_suggestions` Tabelle für lernende Vorschläge

---

## Erwartetes Ergebnis

- Bei neuen Meetings werden Teilnehmernamen automatisch zugeordnet, wenn Recall.ai sie liefert
- Fallback auf lesbare Platform-IDs (E-Mail-Adressen) statt "Unbekannt"
- Benutzer können Sprecher manuell zuordnen, und das System merkt sich die Namen
- Visuelle Unterscheidung der Sprecher durch Farben
- Bei jedem neuen Meeting werden zuvor zugeordnete Namen als Vorschläge angezeigt
