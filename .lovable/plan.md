

# Whitelabel-System: Eigenes Logo pro User

## Uebersicht
Neue Tabelle `user_branding` speichert ein individuelles Logo pro User. Das Logo wird im Header (AppLayout) anstelle des Standard-Icons angezeigt. Upload und Verwaltung erfolgt in den Einstellungen.

## Aenderungen

### 1. Neue Datenbank-Tabelle: `user_branding`

```text
id          uuid  PK  default gen_random_uuid()
user_id     uuid  NOT NULL  UNIQUE
logo_url    text  NULL
app_name    text  NULL  (optionaler eigener App-Name)
created_at  timestamptz  default now()
updated_at  timestamptz  default now()
```

RLS: User kann nur eigene Zeile lesen/schreiben/aendern. Admins haben vollen Zugriff.

### 2. Neuer Hook: `src/hooks/useUserBranding.ts`
- Laedt `logo_url` und `app_name` aus `user_branding` fuer den aktuellen User
- Bietet `updateBranding(logoUrl, appName)` zum Speichern
- Cached im State, laedt einmalig beim Mount

### 3. Settings.tsx — Neue Card "Branding"
- Logo-Upload (aehnlich wie Bot-Avatar-Upload, nutzt `bot-avatars` Bucket oder neuen `user-logos` Bucket)
- Optionales Textfeld fuer eigenen App-Namen (statt "Meeting Recorder")
- Vorschau des Logos
- Entfernen-Button

### 4. AppLayout.tsx — Logo anzeigen
- `useUserBranding()` Hook einbinden
- Wenn `logo_url` vorhanden: Bild anzeigen statt Mic-Icon
- Wenn `app_name` vorhanden: diesen anzeigen statt "Meeting Recorder"

### 5. Storage Bucket
- Neuer Bucket `user-logos` (public) fuer Logo-Bilder
- RLS: User kann nur in eigenem Ordner (`user_id/`) hochladen

## Betroffene Dateien

| Datei | Aenderung |
|---|---|
| Migration | Neue Tabelle `user_branding` + Bucket `user-logos` |
| `src/hooks/useUserBranding.ts` | Neuer Hook |
| `src/pages/Settings.tsx` | Branding-Card mit Logo-Upload + App-Name |
| `src/components/layout/AppLayout.tsx` | Logo/Name aus Hook anzeigen |

