# Projekt-Konfiguration & Secrets

> **Stand:** 13. Dezember 2025  
> **Projekt:** Meeting Note Taker

---

## 1. Lovable Cloud Projekt

| Eigenschaft | Wert |
|-------------|------|
| **Projekt-ID** | `kltxpsrghuxzfbctkdnz` |
| **Supabase URL** | `https://kltxpsrghuxzfbctkdnz.supabase.co` |
| **Anon Key** | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsdHhwc3JnaHV4emZiY3RrZG56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1MjE3NjQsImV4cCI6MjA4MTA5Nzc2NH0.NRFtFUr7M9M2HdS7KvDiOw35vqvzOPsQ8tcD_cWvnpM` |

---

## 2. Secrets (Supabase Edge Functions)

Die folgenden Secrets sind im Lovable Cloud Projekt konfiguriert:

| Secret Name | Beschreibung |
|-------------|--------------|
| `BOT_SERVICE_SECRET` | Secret-Key für Authentifizierung beim externen Bot-Service |
| `BOT_SERVICE_URL` | URL des externen Bot-Service Endpunkts |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret |
| `WEBHOOK_SIGNING_SECRET` | HMAC-Signierung für eingehende Webhooks |
| `SUPABASE_URL` | Supabase Projekt-URL (automatisch) |
| `SUPABASE_ANON_KEY` | Supabase Anonymous Key (automatisch) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key (automatisch) |
| `SUPABASE_DB_URL` | Supabase Datenbank-URL (automatisch) |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase Publishable Key (automatisch) |

---

## 3. Edge Functions

### 3.1 meeting-bot-webhook
- **Pfad:** `supabase/functions/meeting-bot-webhook/index.ts`
- **JWT-Verifizierung:** Deaktiviert (`verify_jwt = false`)
- **Funktion:** Empfängt Webhook-Calls vom Frontend, verifiziert HMAC-Signatur, leitet an externen Bot-Service weiter

### 3.2 google-calendar-auth
- **Pfad:** `supabase/functions/google-calendar-auth/index.ts`
- **JWT-Verifizierung:** Deaktiviert
- **Funktion:** OAuth-Flow für Google Calendar Verbindung

### 3.3 google-calendar-events
- **Pfad:** `supabase/functions/google-calendar-events/index.ts`
- **JWT-Verifizierung:** Deaktiviert
- **Funktion:** Abrufen von Kalender-Events über Google Calendar API

### 3.4 generate-webhook-token
- **Pfad:** `supabase/functions/generate-webhook-token/index.ts`
- **JWT-Verifizierung:** Deaktiviert
- **Funktion:** Generiert signierte HMAC-Tokens für Webhook-Authentifizierung

### 3.5 start-meeting-bot (Extern)
- **Pfad:** `supabase/functions/start-meeting-bot/index.ts`
- **JWT-Verifizierung:** Deaktiviert
- **Funktion:** Empfängt Meeting-Daten und startet den Bot-Prozess

---

## 4. Webhook-Architektur

### 4.1 Authentifizierungsfluss

```
┌─────────────────┐     HMAC-Signatur      ┌──────────────────────┐
│                 │  ─────────────────────▶ │                      │
│  Frontend       │  x-webhook-timestamp   │  meeting-bot-webhook │
│  (Browser)      │  x-webhook-signature   │  (Lovable Cloud)     │
│                 │                        │                      │
└─────────────────┘                        └──────────┬───────────┘
                                                      │
                                                      │ x-secret-key Header
                                                      │ (BOT_SERVICE_SECRET)
                                                      ▼
                                           ┌──────────────────────┐
                                           │                      │
                                           │  start-meeting-bot   │
                                           │  (Externes Projekt)  │
                                           │                      │
                                           └──────────────────────┘
```

### 4.2 Header-Formate

**Frontend → meeting-bot-webhook:**
```
x-webhook-timestamp: 1765619411943
x-webhook-signature: a1b2c3d4e5f6...
Content-Type: application/json
```

**meeting-bot-webhook → start-meeting-bot:**
```
x-secret-key: [BOT_SERVICE_SECRET Wert]
Content-Type: application/json
```

> ⚠️ **Wichtig:** Der `x-secret-key` Header muss **lowercase** sein!

### 4.3 Payload-Struktur

```json
{
  "meeting_id": "event-id-123",
  "meeting_url": "https://meet.google.com/xxx-yyyy-zzz",
  "title": "Team Meeting",
  "start_time": "2025-12-13T10:00:00Z",
  "end_time": "2025-12-13T11:00:00Z",
  "attendees": [
    {
      "email": "user@example.com",
      "displayName": "User Name",
      "responseStatus": "accepted"
    }
  ],
  "triggered_at": "2025-12-13T09:55:00Z"
}
```

---

## 5. Externes Supabase Projekt (Bot-Service)

| Eigenschaft | Wert |
|-------------|------|
| **Projekt-ID** | `iabhybjxxlesojqxewpn` |
| **Bot-Endpunkt** | `https://iabhybjxxlesojqxewpn.supabase.co/functions/v1/start-meeting-bot` |

### Erforderliche Secrets im externen Projekt:
| Secret Name | Muss übereinstimmen mit |
|-------------|-------------------------|
| `WEBHOOK_SIGNING_SECRET` | `BOT_SERVICE_SECRET` (Lovable Cloud) |

---

## 6. Wichtige Hinweise

### 6.1 Secret-Synchronisierung
Der Wert von `BOT_SERVICE_SECRET` (Lovable Cloud) muss **exakt identisch** sein mit `WEBHOOK_SIGNING_SECRET` (externes Projekt).

### 6.2 Header-Format
Der externe Bot-Service erwartet den Header in **lowercase**: `x-secret-key` (nicht `X-Secret-Key`).

### 6.3 Timestamp-Validierung
HMAC-Signaturen sind **5 Minuten** gültig. Danach werden Requests als Replay-Attacken abgelehnt.

### 6.4 Erfolgreiche Response
Bei erfolgreicher Verarbeitung antwortet der Bot-Service mit:
```json
{
  "status": "ok",
  "message": "Meeting bot process started successfully.",
  "received_data": { ... }
}
```

---

## 7. Umgebungsvariablen (.env)

```env
VITE_SUPABASE_URL=https://kltxpsrghuxzfbctkdnz.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_SUPABASE_PROJECT_ID=kltxpsrghuxzfbctkdnz
```

---

## 8. supabase/config.toml

```toml
project_id = "kltxpsrghuxzfbctkdnz"

[functions.meeting-bot-webhook]
verify_jwt = false

[functions.google-calendar-auth]
verify_jwt = false

[functions.google-calendar-events]
verify_jwt = false

[functions.generate-webhook-token]
verify_jwt = false

[functions.start-meeting-bot]
verify_jwt = false
```
