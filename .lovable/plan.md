

## Admin-Ansicht: Account-Zuordnung in /recordings

### Ziel
Admins sehen bei jeder Aufnahme, von welchem Benutzer-Account sie stammt (E-Mail-Adresse), und koennen nach Benutzern filtern.

### Aenderungen

**1. `teamlead-recordings` Edge Function erweitern**
- Neben der bestehenden Teamlead-Pruefung wird ein zweiter Pfad fuer Admins hinzugefuegt
- Wenn der Benutzer Admin ist (geprueft via `has_role`), werden ALLE Recordings aller Benutzer geladen (statt nur Team-Mitglieder)
- Alle Benutzer-E-Mails werden aufgeloest und als `owner_email` an jede Aufnahme angehaengt
- Die Antwort enthaelt eine `members`-Liste mit allen Benutzern (user_id + email), damit der Filter funktioniert

**2. `RecordingsList.tsx` anpassen**
- Neuer Pfad: Wenn `isAdmin` und nicht impersonating, wird ebenfalls die `teamlead-recordings` Edge Function aufgerufen (die jetzt auch fuer Admins funktioniert)
- Die `ownerEmail` wird fuer Admins IMMER angezeigt (nicht nur im Team-Modus)
- Der `viewMode`-Check fuer die Anzeige der `ownerEmail` wird um den Admin-Fall ergaenzt

**3. `Recordings.tsx` anpassen**
- Admins sehen den Mitglieder-Filter (Select-Dropdown) im Aufnahmen-Tab auch ohne Team-Modus
- Die `memberEmails`-Map wird auch fuer Admins befuellt (ueber dieselbe Edge Function)
- Admins brauchen keinen Team-Toggle, da sie standardmaessig alle Recordings sehen

### Technische Details

**teamlead-recordings/index.ts:**
```
// Nach der Teamlead-Pruefung: Admin-Fallback
const { data: isAdmin } = await supabaseAdmin.rpc('has_role', { 
  _user_id: user.id, _role: 'admin' 
});

if (!membership && !isAdmin) {
  return 403 Forbidden;
}

// Wenn Admin: alle Recordings laden, alle User-Emails aufloesen
// Wenn Teamlead: bisherige Logik (nur Team-Members)
```

**RecordingsList.tsx:**
- Admin-Bedingung in `fetchRecordings`: Wenn `isAdmin && !isImpersonating`, rufe `teamlead-recordings` auf (funktioniert jetzt auch fuer Admins)
- `ownerEmail`-Prop wird uebergeben wenn `isAdmin` oder `isTeamView`

**Recordings.tsx:**
- Filter-Dropdown wird angezeigt wenn `isAdmin || (isTeamlead && viewMode === 'team')`
- `memberEmails` wird auch fuer Admins aus der Edge-Function-Antwort befuellt
- Daten werden fuer Admins ueber die erweiterte Edge Function geladen

### Keine Datenbank-Aenderungen noetig
Alle benoetigten Daten sind bereits vorhanden, nur die Edge Function muss um den Admin-Pfad erweitert werden.

