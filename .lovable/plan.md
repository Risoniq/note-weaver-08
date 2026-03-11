

# Admin: Passwort direkt setzen und E-Mail bestätigen

## Problem
Aktuell kann ein Admin nur eine Reset-E-Mail senden. Wenn der User die E-Mail nicht erhält oder der Link abläuft (wie bei christian.muenzberg@nuernberger-automobil.de), gibt es keinen Ausweg. Admins brauchen die Möglichkeit, Passwörter direkt zu setzen und E-Mail-Bestätigungen manuell auszulösen.

## Loesung

### 1. Neue Edge Function: `admin-set-password`
- Nimmt `user_id` und `new_password` entgegen
- Nutzt `supabase.auth.admin.updateUserById(user_id, { password, email_confirm: true })` -- setzt Passwort UND bestätigt gleichzeitig die E-Mail
- Admin-Rollenprüfung, Audit-Log

### 2. Neue Edge Function: `admin-confirm-email`
- Nimmt `user_id` entgegen
- Nutzt `supabase.auth.admin.updateUserById(user_id, { email_confirm: true })` -- bestätigt nur die E-Mail ohne Passwort-Änderung
- Admin-Rollenprüfung, Audit-Log

### 3. UI im Admin-Dashboard (`Admin.tsx`)
- Neuer Button pro User: "Passwort setzen" -- öffnet Dialog mit Passwort-Eingabefeld
- Neuer Button: "E-Mail bestätigen" -- direkter Klick, bestätigt sofort die E-Mail-Adresse
- Beide Aktionen neben dem bestehenden "Passwort-Reset senden" Button

### Betroffene Dateien
- `supabase/functions/admin-set-password/index.ts` (neu)
- `supabase/functions/admin-confirm-email/index.ts` (neu)
- `supabase/config.toml` -- verify_jwt = false für beide neuen Functions
- `src/pages/Admin.tsx` -- UI-Buttons und Dialog

