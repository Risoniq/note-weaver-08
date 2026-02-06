

## Ziel
Alle Edge Functions auf das moderne `npm:` Import-Format und `Deno.serve()` Runtime aktualisieren, um den Admin-Bereich und alle anderen Funktionen der Anwendung zu reparieren.

## Zusammenfassung der Änderungen

| Kategorie | Anzahl Dateien | Änderungstyp |
|-----------|----------------|--------------|
| Bereits korrekt | 3 | Nur Deployment |
| Import-Migration | 20 | `esm.sh` zu `npm:` |
| Volle Migration | 5 | `serve()` zu `Deno.serve()` + Imports |
| **Gesamt** | 28 | |

## Detaillierte Änderungen

### Dateien die KEINE Code-Änderung brauchen (nur Deployment)

1. `supabase/functions/admin-dashboard/index.ts`
2. `supabase/functions/single-meeting-chat/index.ts`
3. `supabase/functions/meeting-bot-webhook/index.ts`

### Dateien mit reiner Import-Migration

Für diese Dateien wird nur Zeile 1 (und ggf. Zeile 2) geändert:

```typescript
// ALT:
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// NEU:
import { createClient } from 'npm:@supabase/supabase-js@2';
```

**Admin-Funktionen (12 Dateien):**
- `admin-approve-user/index.ts`
- `admin-delete-user/index.ts`
- `admin-set-quota/index.ts`
- `admin-create-team/index.ts`
- `admin-update-team/index.ts`
- `admin-delete-team/index.ts`
- `admin-assign-team-member/index.ts`
- `admin-list-api-keys/index.ts`
- `admin-create-api-key/index.ts`
- `admin-delete-api-key/index.ts`
- `admin-save-webhook-config/index.ts`
- `admin-view-user-data/index.ts`

**Utility-Funktionen (5 Dateien):**
- `export-transcripts/index.ts`
- `bulk-export-recordings/index.ts`
- `repair-all-recordings/index.ts`
- `cleanup-stale-recordings/index.ts`
- `teamlead-recordings/index.ts`

**API-Funktionen (6 Dateien):**
- `api-transcripts/index.ts`
- `api-team-stats/index.ts`
- `api-import-transcript/index.ts`
- `api-update-recording/index.ts`
- `api-webhook-callback/index.ts`
- `api-dashboard/index.ts`

### Dateien mit vollständiger Migration (serve() + Imports)

**admin-create-meeting/index.ts:**
```typescript
// ALT (Zeile 1-2):
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// ... 
serve(async (req) => {

// NEU:
import { createClient } from 'npm:@supabase/supabase-js@2';
// ...
Deno.serve(async (req) => {
```

**start-meeting-bot/index.ts:**
```typescript
// ALT (Zeile 1):
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
serve(async (req) => {

// NEU:
// (keine Imports mehr nötig, serve entfernen)
Deno.serve(async (req) => {
```

**edit-email-ai/index.ts:**
```typescript
// ALT (Zeile 1):
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
serve(async (req) => {

// NEU:
Deno.serve(async (req) => {
```

**generate-webhook-token/index.ts:**
```typescript
// ALT (Zeile 1):
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
serve(async (req) => {

// NEU:
Deno.serve(async (req) => {
```

**desktop-sdk-webhook/index.ts:**
```typescript
// ALT (Zeile 1-2):
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
serve(async (req) => {

// NEU:
import { createClient } from 'npm:@supabase/supabase-js@2';
Deno.serve(async (req) => {
```

### Sonderfall: create-bot/index.ts

Diese Funktion hat zusätzlich einen base64-Import der ersetzt werden muss:

```typescript
// ALT (Zeile 1-2):
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.208.0/encoding/base64.ts";

// NEU:
import { createClient } from 'npm:@supabase/supabase-js@2';

// Zeile 173 (base64Encode Verwendung):
// ALT:
const base64String = base64Encode(uint8Array);

// NEU (Web Standard):
const base64String = btoa(String.fromCharCode(...uint8Array));
```

## Deployment-Plan

Nach den Code-Änderungen werden alle 28 Funktionen deployed:

1. **Admin-Funktionen** (14)
2. **API-Funktionen** (6)  
3. **Utility-Funktionen** (5)
4. **Bot/Webhook-Funktionen** (3)

## Erwartete Ergebnisse

Nach erfolgreichem Deployment:
- Admin-Bereich öffnet ohne "Failed to send request" Fehler
- Benutzer freischalten/löschen funktioniert
- Teams erstellen/bearbeiten/löschen funktioniert
- API-Schlüssel verwalten funktioniert
- Meeting-Bot starten funktioniert
- E-Mail-Bearbeitung mit KI funktioniert
- Transkript-Export funktioniert
- Alle Funktionen antworten mit HTTP-Statuscodes statt 404

## Sicherheitshinweis

Diese Änderungen betreffen NUR den Quellcode der Edge Functions. Es werden keine Daten gelöscht oder modifiziert:
- Keine Datenbank-Änderungen
- Keine Transkript-Löschungen
- Keine Benutzer-Änderungen
- Reine Import-Syntax-Aktualisierung

