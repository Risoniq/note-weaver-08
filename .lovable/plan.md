

# Passwort-Reset Flow korrigieren

## Problem
1. Die Edge Function nutzt `generateLink()` — das generiert nur einen Link, sendet aber **keine E-Mail** automatisch
2. Es fehlt eine `/reset-password` Seite, auf der User ihr neues Passwort eingeben koennen
3. Der Redirect in `useAuth.resetPassword` zeigt auf `/auth` statt auf eine dedizierte Reset-Seite

## Aenderungen

### 1. Edge Function `admin-send-password-reset` anpassen
- Statt `generateLink()` → `resetPasswordForEmail(email, { redirectTo })` verwenden (mit Service-Role-Client)
- Das sendet die Recovery-E-Mail automatisch an die hinterlegte Adresse
- `redirectTo` auf `{siteUrl}/reset-password` setzen

### 2. Neue Seite: `src/pages/ResetPassword.tsx`
- Formular mit neuem Passwort + Bestaetigung
- Gleiche Passwortstärke-Anzeige wie bei der Registrierung
- Prueft URL-Hash auf `type=recovery`
- Ruft `supabase.auth.updateUser({ password })` auf
- Erfolgsmeldung + Weiterleitung zum Login

### 3. `src/App.tsx` — Route hinzufuegen
- `<Route path="/reset-password" element={<ResetPassword />} />` (oeffentlich, nicht hinter ProtectedRoute)

### 4. `src/hooks/useAuth.ts` — redirectTo anpassen
- `resetPassword()`: redirectTo auf `/reset-password` statt `/auth` aendern (fuer den Self-Service-Reset)

| Datei | Aenderung |
|---|---|
| `supabase/functions/admin-send-password-reset/index.ts` | `resetPasswordForEmail` statt `generateLink` |
| `src/pages/ResetPassword.tsx` | Neue Seite zum Passwort-Setzen |
| `src/App.tsx` | Route `/reset-password` registrieren |
| `src/hooks/useAuth.ts` | redirectTo korrigieren |

