

## calendar_attendees als Fallback + Meeting neu erstellen

### 1. calendar_attendees-Fallback in der Teilnehmer-Logik

**Problem:** Wenn `participants` leer ist, wird nur das Transkript als Fallback genutzt. Die `calendar_attendees` (aus dem Kalender-Event) enthalten oft bessere Namensdaten, werden aber ignoriert.

**Aenderungen:**

**`src/types/recording.ts`**
- Feld `calendar_attendees` zum `Recording`-Interface hinzufuegen:
  ```
  calendar_attendees: { name: string; email: string }[] | null;
  ```

**`src/utils/participantUtils.ts`**
- `getConsistentParticipantCount` erweitern: Zwischen Schritt 1 (DB-participants) und Schritt 2 (Transkript) einen neuen Fallback einfuegen:
  1. DB-Teilnehmer (participants)
  2. **NEU: calendar_attendees** -- Namen aus dem Kalender-Event nutzen, Bots filtern
  3. Transkript-Extraktion
  4. Absoluter Fallback
- Das Input-Interface um `calendar_attendees` erweitern
- Source-Typ um `'calendar'` ergaenzen

**`src/components/recordings/RecordingCard.tsx`**
- Keine Aenderung noetig -- nutzt bereits `getConsistentParticipantCount(recording)`, und da das Recording-Objekt aus der DB `calendar_attendees` enthaelt, wird es automatisch durchgereicht.

### 2. Meeting 35f71338 neu erstellen

Das Recording mit ID `35f71338-92d3-47b2-826b-6e3cfa9807c5` existiert nicht mehr in der Datenbank. Um es neu zu analysieren, muss es ueber das Admin-Dashboard ("Meeting erstellen") mit dem Transkript-Text neu angelegt werden. Das ist ein manueller Schritt -- sofern du das Transkript noch hast, kann ich dir dabei helfen es ueber die bestehende Admin-Funktion einzuspeisen.

### Betroffene Dateien

| Datei | Aenderung |
|-------|-----------|
| `src/types/recording.ts` | `calendar_attendees` Feld hinzufuegen |
| `src/utils/participantUtils.ts` | calendar_attendees als Fallback-Stufe 2 einbauen |

