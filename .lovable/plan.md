

## Kalender-Reiter in die Einstellungen verschieben

### Ziel
Der "Kalender"-Reiter wird aus der Header-Navigation entfernt und stattdessen als Abschnitt (Card) in die Einstellungen-Seite integriert. Die Route `/calendar` bleibt bestehen, leitet aber auf `/settings` weiter.

### Aenderungen

**1. `src/components/layout/AppLayout.tsx` -- Kalender aus Navigation entfernen**
- Den Eintrag `{ title: "Kalender", url: "/calendar", icon: Calendar }` aus dem `navItems` Array entfernen

**2. `src/pages/Settings.tsx` -- Kalender-Inhalte einbetten**
- Die Kalender-Verbindungen (Google/Microsoft) und Aufnahme-Einstellungen aus `Calendar.tsx` direkt in die Settings-Seite einbauen
- Zwei neue Cards hinzufuegen (nach den Bot-Einstellungen):
  - "Kalender-Verbindungen" -- mit der `RecallCalendarConnection` Komponente
  - "Aufnahme-Einstellungen" -- mit den Auto-Record/Record-All Switches
- Die notwendigen Hooks (`useRecallCalendarMeetings`, `useGoogleRecallCalendar`, `useMicrosoftRecallCalendar`) in Settings importieren
- Die Settings-Seite in das `AppLayout` einbetten (aktuell nutzt sie ein eigenes Layout)

**3. `src/App.tsx` -- Route anpassen**
- Die `/calendar` Route aendern zu einem Redirect auf `/settings` (fuer bestehende Links/Bookmarks)

**4. `src/components/layout/AppLayout.tsx` -- Onboarding-Tour Attribut anpassen**
- Das `data-tour="calendar-nav"` Attribut entfernen (da der Kalender-Nav-Link wegfaellt)

### Betroffene Dateien

| Datei | Aenderung |
|-------|-----------|
| `src/components/layout/AppLayout.tsx` | Kalender aus `navItems` entfernen |
| `src/pages/Settings.tsx` | Kalender-Cards mit Hooks einbauen, AppLayout verwenden |
| `src/App.tsx` | `/calendar` Route zu Redirect auf `/settings` aendern |

