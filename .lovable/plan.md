
# Plan: Admin "Als Benutzer anzeigen"-Funktion

## Übersicht

Als Admin möchtest du in die Einstellungen anderer Benutzer wechseln können, um deren Ansicht einzusehen. Dies wird durch eine **Impersonation-Funktion** umgesetzt, die es Admins ermöglicht, die App temporär "durch die Brille" eines anderen Benutzers zu sehen.

## Architektur

```text
┌─────────────────────────────────────────────────────────────┐
│                     Admin Dashboard                          │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Benutzer-Tabelle                                   │    │
│  │  ┌────────────────────────────────────────────────┐ │    │
│  │  │ user@example.com  │ ... │ [👁️ Ansicht anzeigen] │ │    │
│  │  └────────────────────────────────────────────────┘ │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Impersonation Context (React Context)                       │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ impersonatedUserId: "abc-123"                           ││
│  │ impersonatedUserEmail: "user@example.com"               ││
│  │ isImpersonating: true                                   ││
│  │ stopImpersonating: () => void                           ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Benutzer-Ansicht (Dashboard/Settings/etc.)                 │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ⚠️ Banner: "Du siehst die Ansicht von user@example.com" ││
│  │                                    [Zurück zum Admin]   ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  • Recordings werden für impersonatedUserId geladen          │
│  • Settings werden für impersonatedUserId angezeigt          │
│  • Quota wird für impersonatedUserId berechnet               │
└─────────────────────────────────────────────────────────────┘
```

## Umsetzungsschritte

### Schritt 1: Impersonation Context erstellen

Neue Datei: `src/contexts/ImpersonationContext.tsx`

```typescript
interface ImpersonationContextType {
  impersonatedUserId: string | null;
  impersonatedUserEmail: string | null;
  isImpersonating: boolean;
  startImpersonating: (userId: string, email: string) => void;
  stopImpersonating: () => void;
  getEffectiveUserId: () => string | null;
}
```

- Speichert temporär die ID des impersonierten Benutzers
- Stellt `getEffectiveUserId()` bereit, die entweder die impersonierte ID oder die echte User-ID zurückgibt
- Bietet Funktionen zum Starten und Beenden der Impersonation

### Schritt 2: Impersonation Banner-Komponente

Neue Datei: `src/components/admin/ImpersonationBanner.tsx`

- Zeigt einen auffälligen Banner oben in der App, wenn Impersonation aktiv ist
- Enthält "Zurück zum Admin"-Button
- Zeigt E-Mail des impersonierten Benutzers an

### Schritt 3: Admin Dashboard erweitern

Datei: `src/pages/Admin.tsx`

- Neuen Button "Ansicht anzeigen" (👁️) in der Aktionen-Spalte hinzufügen
- Button ruft `startImpersonating(userId, email)` auf
- Navigiert zu `/` (Dashboard) nach dem Start

### Schritt 4: Hooks anpassen für Impersonation-Support

Die folgenden Hooks müssen angepasst werden, um `getEffectiveUserId()` statt `auth.uid()` zu verwenden:

| Datei | Änderung |
|-------|----------|
| `src/hooks/useUserQuota.ts` | Impersonation Context importieren, `getEffectiveUserId()` nutzen |
| `src/components/recordings/RecordingsList.tsx` | Query mit impersonierter User-ID filtern (nur für Admins) |
| `src/pages/Settings.tsx` | Bot-Settings und Backups für impersonierten User laden |

### Schritt 5: Edge Function für Admin-Datenabfrage

Da RLS die Daten auf den aktuellen Benutzer beschränkt, muss für Admin-Impersonation eine Edge Function verwendet werden:

Neue Datei: `supabase/functions/admin-view-user-data/index.ts`

- Verifiziert Admin-Berechtigung
- Lädt Daten für den angegebenen Benutzer:
  - Recordings
  - Bot-Settings (recall_calendar_users)
  - Transcript-Backups
  - Quota-Informationen

### Schritt 6: App.tsx Provider hinzufügen

Datei: `src/App.tsx`

- `ImpersonationProvider` um die App-Komponenten wrappen
- Zwischen `TourProvider` und `TooltipProvider` einfügen

### Schritt 7: AppLayout Banner einbinden

Datei: `src/components/layout/AppLayout.tsx`

- `ImpersonationBanner` oberhalb der Navigation einfügen
- Wird nur angezeigt, wenn `isImpersonating === true`

## Sicherheit

- **Nur Admins** können die Impersonation starten (Admin-Check via `useAdminCheck`)
- Impersonation ist **read-only** – es können keine Daten im Namen des Benutzers geändert werden
- Die Edge Function validiert Admin-Berechtigung via `has_role()`
- Kein Zugriff auf Auth-Credentials des impersonierten Benutzers

## Betroffene Dateien

| Datei | Aktion |
|-------|--------|
| `src/contexts/ImpersonationContext.tsx` | Neu erstellen |
| `src/components/admin/ImpersonationBanner.tsx` | Neu erstellen |
| `supabase/functions/admin-view-user-data/index.ts` | Neu erstellen |
| `src/pages/Admin.tsx` | Button hinzufügen |
| `src/App.tsx` | Provider einfügen |
| `src/components/layout/AppLayout.tsx` | Banner einfügen |
| `src/hooks/useUserQuota.ts` | Impersonation-Support |
| `src/components/recordings/RecordingsList.tsx` | Impersonation-Support |
| `src/pages/Settings.tsx` | Impersonation-Support |

## Nach der Implementierung

1. Im Admin Dashboard einen Benutzer auswählen und "Ansicht anzeigen" klicken
2. Der Banner erscheint und zeigt die E-Mail des impersonierten Benutzers
3. Dashboard, Einstellungen und Transkripte zeigen die Daten dieses Benutzers
4. "Zurück zum Admin" beendet die Impersonation
