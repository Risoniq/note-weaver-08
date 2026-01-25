
# Admin-Zugriff auf Recordings und User-ID im Transkript-Header

## Problem-Analyse

**403-Fehler erklärt:**
Die Edge Function Logs zeigen klar das Problem:
- Eingeloggter User: `704551d2-286b-4e57-80d0-721f198aea43` (hat **Admin-Rolle**)
- Recording-Owner: `725ab560-e2f9-4e4f-938f-635bc14951fe` (hat **approved-Rolle**)

Die Edge Functions `sync-recording` und `analyze-transcript` prüfen aktuell nur, ob der aktuelle Benutzer der Owner ist - sie ignorieren die Admin-Rolle, obwohl die RLS-Policies in der Datenbank Admins bereits Zugriff gewähren.

## Geplante Änderungen

### 1. Admin-Prüfung in sync-recording hinzufügen

**Datei: `supabase/functions/sync-recording/index.ts`**

Die Ownership-Prüfung (Zeile 115-122) erweitern um Admin-Check:

```typescript
// Bestehend:
if (recording.user_id && recording.user_id !== user.id) {
  console.error(`[Auth] User ${user.id} tried to access recording owned by ${recording.user_id}`);
  return new Response(
    JSON.stringify({ error: 'Access denied' }),
    { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Neu: Admin-Check hinzufügen
if (recording.user_id && recording.user_id !== user.id) {
  // Prüfe ob User Admin ist
  const { data: adminCheck } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle();
  
  if (!adminCheck) {
    console.error(`[Auth] User ${user.id} tried to access recording owned by ${recording.user_id}`);
    return new Response(
      JSON.stringify({ error: 'Access denied' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  console.log(`[Auth] Admin ${user.id} accessing recording owned by ${recording.user_id}`);
}
```

### 2. Admin-Prüfung in analyze-transcript hinzufügen

**Datei: `supabase/functions/analyze-transcript/index.ts`**

Gleiche Logik bei Zeile 108-115 einbauen.

### 3. User-ID im Transkript-Header in der Datenbank speichern

**Datei: `supabase/functions/sync-recording/index.ts`**

Beim Formatieren des Transkripts (ca. Zeile 510-535) einen Header mit User-Informationen einfügen:

```typescript
// Header für Datenbank-Transkript hinzufügen
const userId = recording.user_id || user.id;

// User-Email abrufen für bessere Lesbarkeit
const { data: userData } = await supabase.auth.admin.getUserById(userId);
const userEmail = userData?.user?.email || 'Unbekannt';

const transcriptHeader = `[Meeting-Info]
User-ID: ${userId}
User-Email: ${userEmail}
Recording-ID: ${id}
Erstellt: ${new Date(recording.created_at || Date.now()).toISOString()}
---\n\n`;

updates.transcript_text = transcriptHeader + formattedTranscript;
```

## Zusammenfassung der Änderungen

| Datei | Änderung |
|-------|----------|
| `supabase/functions/sync-recording/index.ts` | Admin-Check bei Ownership-Prüfung hinzufügen + User-ID/Email Header im Transkript |
| `supabase/functions/analyze-transcript/index.ts` | Admin-Check bei Ownership-Prüfung hinzufügen |

## Ergebnis

- **Admin-Zugriff**: Admins können "Transkript neu laden" für alle Recordings ausführen
- **Backend-Übersicht**: Jedes Transkript enthält im Header die User-ID und E-Mail des Besitzers
- **Sicherheit bleibt erhalten**: Normale Benutzer können weiterhin nur ihre eigenen Recordings bearbeiten
- **Konsistenz**: Sowohl sync-recording als auch analyze-transcript nutzen die gleiche Admin-Logik

## Technische Details

### Admin-Check Pattern
```typescript
// Wiederverwendbares Pattern für alle Edge Functions:
async function isAdmin(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle();
  return !!data;
}
```

### Transkript-Header Format
```text
[Meeting-Info]
User-ID: 725ab560-e2f9-4e4f-938f-635bc14951fe
User-Email: user@example.com
Recording-ID: 0865b411-5579-4b64-b45c-622c5c978a50
Erstellt: 2026-01-21T14:58:56.705Z
---

Max Mustermann: Guten Morgen allerseits...
Anna Schmidt: Hallo Max, danke für die Einladung...
```
