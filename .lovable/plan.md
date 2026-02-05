

# Plan: Bot-Fehler diagnostizieren und beheben

## Aktuelle Situation

Die Edge Function `create-bot` funktioniert einwandfrei! Meine Tests haben ergeben:

| Test | Ergebnis |
|------|----------|
| Edge Function direkt aufrufen | ✅ Erfolgreich (Status 200) |
| Bot erstellen mit authuser=0 | ✅ Erfolgreich |
| Datenbank-Eintraege | ✅ 2 Bots mit Status "joining" |
| Edge Function Logs | ✅ Alle Schritte erfolgreich |

## Erstellte Bots (beide aktiv!)

```text
Bot 1: 1c8b68f6-75d7-449a-9bb4-eeaaa571022f
Bot 2: 0803a12f-f4bf-4f5a-90f1-00c39bce4f18
Meeting: https://meet.google.com/bib-cwix-reo
Status: joining (beide versuchen beizutreten)
```

## Moegliche Ursachen fuer Frontend-Fehler

### 1. Abgelaufene Session (wahrscheinlichste Ursache)
Der Auth-Token im Browser koennte abgelaufen sein. Der `withTokenRefresh` Wrapper sollte das eigentlich auffangen, aber manchmal hilft nur ein kompletter Re-Login.

**Loesung:** Seite neu laden oder ausloggen und wieder einloggen.

### 2. Doppelte Fehlermeldung
Das Frontend zeigt moeglicherweise einen alten Fehler an, obwohl der Bot tatsaechlich gestartet wurde.

**Test:** Pruefe, ob ein "Notetaker" oder "ECPD Notetaker" Bot deinem Meeting beitritt.

### 3. Verbesserte Fehlerbehandlung implementieren
Der Catch-Block im Frontend gibt nur eine generische Meldung aus. Wir koennten die tatsaechliche Fehlermeldung vom Server anzeigen.

## Empfohlene Aenderung: Bessere Fehlermeldungen

```text
Datei: src/components/calendar/QuickMeetingJoin.tsx

Zeile 85-91 (catch-Block) verbessern:

VORHER:
catch (error) {
  console.error('Error sending bot:', error);
  toast({
    title: 'Fehler',
    description: 'Bot konnte nicht gestartet werden. Bitte versuche es erneut.',
    variant: 'destructive',
  });
}

NACHHER:
catch (error: any) {
  console.error('Error sending bot:', error);
  
  // Spezifische Fehlermeldungen behandeln
  let errorMessage = 'Bot konnte nicht gestartet werden.';
  
  if (error?.message?.includes('Quota exhausted')) {
    errorMessage = 'Dein Meeting-Kontingent ist erschoepft.';
  } else if (error?.message?.includes('401') || error?.message?.includes('Unauthorized')) {
    errorMessage = 'Sitzung abgelaufen. Bitte lade die Seite neu und logge dich erneut ein.';
  } else if (error?.message?.includes('Failed to fetch') || error?.message?.includes('NetworkError')) {
    errorMessage = 'Netzwerkfehler. Bitte pruefe deine Internetverbindung.';
  } else if (error?.message) {
    errorMessage = error.message;
  }
  
  toast({
    title: 'Fehler',
    description: errorMessage,
    variant: 'destructive',
  });
}
```

## Sofort-Aktion

**Der Bot sollte bereits beitreten!** Da ich zwei Bots erfolgreich erstellt habe, solltest du in deinem Google Meet schauen:

1. Oeffne https://meet.google.com/bib-cwix-reo
2. Schau nach "ECPD Notetaker" im Wartebereich oder Teilnehmerbereich
3. Lass den Bot rein, falls er wartet

## Naechste Schritte

1. **Sofort pruefen:** Schau in dein Meeting, ob der Bot wartet
2. **Falls kein Bot sichtbar:** Seite neu laden und erneut versuchen
3. **Falls weiterhin Fehler:** Bessere Fehlermeldungen implementieren

