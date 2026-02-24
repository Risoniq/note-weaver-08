
# Session-Timeout nur bei Tab-Wechsel

## Aktuelles Verhalten
Der Timer laeuft bei Inaktivitaet innerhalb des Tabs ab (15 Min ohne Maus/Tastatur). Das fuehrt zu ungewollten Logouts waehrend der Nutzer die App aktiv im Vordergrund hat.

## Neues Verhalten
- Der Timeout-Timer startet **nur**, wenn der Browser-Tab in den Hintergrund wechselt (z.B. anderer Tab, anderes Fenster)
- Sobald der Nutzer zum Tab zurueckkehrt, wird der Timer zurueckgesetzt
- Wenn der Tab 15 Minuten im Hintergrund bleibt, erscheint beim Zurueckkehren die Warnung bzw. der Logout erfolgt automatisch

## Technische Umsetzung

### Datei: `src/hooks/useSessionTimeout.ts`

- Alle Event-Listener fuer `mousemove`, `keydown`, `click`, `scroll`, `touchstart` entfernen
- Stattdessen die **Page Visibility API** nutzen (`document.visibilitychange`)
- Wenn `document.hidden === true`: Timer starten (15 Min bis Logout, 13 Min bis Warnung)
- Wenn `document.hidden === false` (Tab wieder aktiv): Timer zuruecksetzen, Warnung ausblenden
- Der `paused`-Parameter fuer Aufnahmen bleibt erhalten

### Ablauf

```text
Tab sichtbar  -->  Kein Timer aktiv, Session laeuft normal
Tab verborgen -->  Timer startet (13 Min Warnung, 15 Min Logout)
Tab wieder sichtbar (vor 15 Min)  -->  Timer wird zurueckgesetzt
Tab wieder sichtbar (nach 15 Min) -->  Logout wird ausgefuehrt
```

Keine weiteren Dateien betroffen.
