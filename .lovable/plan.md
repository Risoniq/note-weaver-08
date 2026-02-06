

## SSL-Zertifikat Auswirkungsanalyse und Korrekturplan

### Befund

Nach der SSL-Einrichtung fuer `notetaker2pro.com` gibt es ein kritisches CORS-Problem: **5 Edge Functions mit dynamischer CORS-Konfiguration enthalten die Domain `notetaker2pro.com` NICHT in ihrer erlaubten Origins-Liste.** Anfragen von der Produktions-Domain werden daher moeglicherweise blockiert.

---

### Kategorisierung aller 42 Edge Functions

**Kategorie A - Dynamische CORS MIT notetaker2pro.com (10 Funktionen) -- OK**

Diese Funktionen enthalten `https://notetaker2pro.com` und `https://www.notetaker2pro.com` explizit:

| Funktion | Status |
|---|---|
| google-calendar-events | OK |
| sync-recording | OK |
| admin-view-user-data | OK |
| create-bot | OK |
| analyze-transcript | OK |
| recall-calendar-meetings | OK |
| microsoft-recall-auth | OK |
| meeting-bot-webhook | OK |
| google-recall-auth | OK |
| repair-all-recordings | OK |

**Kategorie B - Dynamische CORS OHNE notetaker2pro.com (5 Funktionen) -- PROBLEM**

Diese Funktionen haben dynamische CORS, aber nur `APP_URL`, localhost und Lovable-Domains. Wenn `APP_URL` nicht auf `https://notetaker2pro.com` gesetzt ist, werden Anfragen von der Produktions-Domain ABGELEHNT:

| Funktion | Auswirkung |
|---|---|
| google-calendar-auth | Kalender-OAuth Login funktioniert nicht |
| start-meeting-bot | Meeting-Bot kann nicht gestartet werden |
| recall-calendar-auth | Recall-Kalender-Verbindung funktioniert nicht |
| generate-webhook-token | Webhook-Token-Generierung schlaegt fehl |
| admin-create-meeting | Admin kann keine Meetings erstellen |

**Kategorie C - Wildcard CORS `*` (26 Funktionen) -- OK**

Diese nutzen `Access-Control-Allow-Origin: *` und funktionieren mit jeder Domain:

admin-approve-user, admin-assign-team-member, admin-create-api-key, admin-create-team, admin-dashboard, admin-delete-api-key, admin-delete-team, admin-delete-user, admin-list-api-keys, admin-save-webhook-config, admin-set-quota, admin-update-team, api-dashboard, api-import-transcript, api-team-stats, api-transcripts, api-update-recording, api-webhook-callback, cleanup-stale-recordings, desktop-sdk-webhook, edit-email-ai, export-transcripts, meeting-chat, single-meeting-chat, teamlead-recordings, transcribe-audio

**Kategorie D - bulk-export-recordings -- PROBLEM**

Diese Funktion hat eine eigene CORS-Logik die `notetaker2pro.com` ebenfalls NICHT enthaelt.

---

### Loesung

Alle 6 betroffenen Funktionen erhalten die standardisierte CORS-Konfiguration mit expliziter Unterstuetzung fuer `notetaker2pro.com`:

**Aenderung fuer jede betroffene Funktion:**

```text
Vorher (Kategorie B):
  allowedOrigins = [
    APP_URL,
    'http://localhost:5173',
    'http://localhost:8080',
    'http://localhost:3000',
  ]

Nachher:
  allowedOrigins = [
    APP_URL,
    'https://notetaker2pro.com',
    'https://www.notetaker2pro.com',
    'http://localhost:5173',
    'http://localhost:8080',
    'http://localhost:3000',
  ]
```

### Betroffene Dateien

| Datei | Aenderung |
|---|---|
| `supabase/functions/google-calendar-auth/index.ts` | notetaker2pro.com zu CORS hinzufuegen |
| `supabase/functions/start-meeting-bot/index.ts` | notetaker2pro.com zu CORS hinzufuegen |
| `supabase/functions/recall-calendar-auth/index.ts` | notetaker2pro.com zu CORS hinzufuegen |
| `supabase/functions/generate-webhook-token/index.ts` | notetaker2pro.com zu CORS hinzufuegen |
| `supabase/functions/admin-create-meeting/index.ts` | notetaker2pro.com zu CORS hinzufuegen |
| `supabase/functions/bulk-export-recordings/index.ts` | notetaker2pro.com zu CORS hinzufuegen |

### Zusaetzliche Pruefung: OAuth Redirect URIs

Die OAuth-Flows (Google/Microsoft Kalender) nutzen `window.location.origin` fuer die Redirect-URI. Das bedeutet:
- Von `https://notetaker2pro.com` wird `https://notetaker2pro.com/calendar-callback` als Redirect-URI verwendet
- Diese URL muss auch in der Google Cloud Console und Microsoft Azure als erlaubte Redirect-URI konfiguriert sein
- Die Edge Functions selbst unterstuetzen dies bereits korrekt, da `redirectUri` dynamisch vom Client kommt

### Keine weiteren Einschraenkungen

- SSL aendert nichts an der Datenbank-Verbindung (Supabase nutzt eigenes SSL)
- Storage-Buckets (audio-uploads, transcript-backups) sind nicht betroffen
- Authentifizierung via JWT funktioniert unabhaengig von der Domain
- Die Wildcard-CORS-Funktionen (26 Stueck) funktionieren weiterhin problemlos

### Geschaetzter Aufwand
- 6 Dateien, jeweils nur 2 Zeilen hinzufuegen
- Deployment aller 6 Funktionen nach der Aenderung

