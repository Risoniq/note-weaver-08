
# Speicherlimit auf 750 MB erhoehen

Einfache Anpassung an vier Stellen in zwei Dateien:

## Aenderungen

### 1. `src/hooks/useQuickRecording.ts`
- Zeile 6: Konstante von `500 * 1024 * 1024` auf `750 * 1024 * 1024` aendern
- Zeile 89: Kommentar auf "750 MB" aktualisieren
- Zeile 91: Toast-Text von "500 MB" auf "750 MB" aktualisieren

### 2. `src/components/MeetingNoteTaker.tsx`
- Zeile 26: Konstante von `500 * 1024 * 1024` auf `750 * 1024 * 1024` aendern
- Zeile 223: Kommentar auf "750 MB" aktualisieren
- Zeile 227: Toast-Text von "500 MB" auf "750 MB" aktualisieren

Damit sind bei normaler Audioqualitaet circa 3-4 Stunden Aufnahme moeglich.
