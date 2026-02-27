

# Passwort-Reset per Admin senden

## Aenderungen

### 1. Neue Edge Function: `admin-send-password-reset`
- Empfaengt `user_id`, prueft Admin-Rechte
- Holt die E-Mail des Users via `supabaseAdmin.auth.admin.getUserById()`
- Ruft `supabaseAdmin.auth.admin.generateLink({ type: 'recovery', email })` auf, um einen Reset-Link zu generieren
- Sendet die Reset-E-Mail ueber den Standard-Auth-Flow (oder gibt den Link zurueck, falls kein SMTP konfiguriert ist)

### 2. `src/pages/Admin.tsx`
- Neuer Handler `handleSendPasswordReset(userId, email)` — ruft die Edge Function auf
- Neuer Button in der Aktionen-Spalte (Zeile ~1005, nach dem Loeschen-Dialog): Schloss-Icon mit Tooltip "Passwort-Reset senden"
- Bestaetigung via Toast ("Passwort-Reset wurde an {email} gesendet")
- Import von `KeyRound` Icon aus lucide-react

| Datei | Aenderung |
|---|---|
| `supabase/functions/admin-send-password-reset/index.ts` | Neue Edge Function |
| `src/pages/Admin.tsx` | Button + Handler hinzufuegen |

