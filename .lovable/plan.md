

# Passwort-Sichtbarkeit und Erklärung "E-Mail bestätigen"

## Was macht "E-Mail bestätigen"?

Wenn ein User sich registriert, muss er normalerweise seine E-Mail bestätigen (Klick auf den Link in der Bestätigungs-E-Mail). Solange das nicht passiert ist, kann sich der User **nicht einloggen**. Die Funktion "E-Mail bestätigen" setzt diesen Status manuell auf "bestätigt", ohne dass der User auf einen Link klicken muss. Das ist nützlich wenn:
- Die Bestätigungs-E-Mail nicht ankommt
- Der Link abgelaufen ist
- Man einen User schnell freischalten will

## Änderung: Passwort ein-/ausblenden

Im Passwort-Dialog wird ein Augen-Icon neben dem Eingabefeld ergänzt, das zwischen `type="password"` und `type="text"` umschaltet.

### Betroffene Datei
- `src/pages/Admin.tsx` — Zeile ~1388-1394: Input-Feld von `type="password"` auf dynamisch umschalten, neuer State `showPassword`, Eye/EyeOff Icon-Button rechts im Feld

