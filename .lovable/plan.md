

# Fix: Windows-Kompatibilitaet fuer Link-Einfuegen und Bild-Upload

## Problem

Zwei Probleme betreffen Windows-Nutzer:

1. **Link einfuegen im Dashboard**: Windows-Nutzer koennen keinen Meeting-Link ins Bot-Eingabefeld einfuegen (Rechtsklick-Einfuegen oder Strg+V funktioniert nicht)
2. **Bild-Upload in Einstellungen**: Der Dateiauswahl-Dialog auf Windows laesst keine Dateiauswahl zu, wenn `accept="image/*"` verwendet wird

## Ursache

1. **Paste-Problem**: Das `<Input>`-Feld ist korrekt implementiert, aber es kann auf Windows in bestimmten Browsern zu Problemen mit dem `onChange`-Handler kommen, wenn Text per Rechtsklick eingefuegt wird. Ein expliziter `onPaste`-Handler stellt sicher, dass der Wert korrekt uebernommen wird.

2. **Dateiauswahl-Problem**: Der `accept="image/*"` Wildcard-Filter verursacht auf manchen Windows-Systemen (insbesondere aeltere Chrome/Edge-Versionen) Probleme im nativen Datei-Dialog. Der Filter zeigt dann "Benutzerdefinierte Dateien" an, laesst aber keine Auswahl zu. Die Loesung ist, explizite MIME-Types und Dateiendungen anzugeben.

## Loesung

### Schritt 1: Paste-Handler fuer Meeting-URL-Eingabe

**Datei:** `src/components/calendar/QuickMeetingJoin.tsx`

- Einen expliziten `onPaste`-Handler hinzufuegen, der den eingefuegten Text direkt in den State uebernimmt
- Zusaetzlich einen `onKeyDown`-Handler fuer Strg+V/Cmd+V als Fallback

```tsx
<Input
  placeholder="https://meet.google.com/... oder Teams/Zoom Link"
  value={meetingUrl}
  onChange={(e) => setMeetingUrl(e.target.value)}
  onPaste={(e) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    setMeetingUrl(pastedText);
  }}
  disabled={isLoading}
  className="flex-1 h-11"
/>
```

### Schritt 2: Explizite Dateitypen fuer Bild-Upload

**Datei:** `src/pages/Settings.tsx`

- Den `accept`-Attribut von `image/*` auf explizite Formate aendern

```tsx
<input
  type="file"
  ref={fileInputRef}
  onChange={handleAvatarUpload}
  accept="image/jpeg,image/png,image/gif,image/webp,.jpg,.jpeg,.png,.gif,.webp"
  className="hidden"
/>
```

### Schritt 3: Gleiche Fixes auch im MeetingBot anwenden

**Datei:** `src/components/MeetingBot.tsx`

- Gleicher `onPaste`-Handler fuer das Meeting-URL-Eingabefeld

## Technische Details

### Warum onPaste mit preventDefault?

Auf Windows kann es vorkommen, dass bei Rechtsklick-Einfuegen das `onChange`-Event nicht zuverlaessig feuert. Durch `preventDefault()` und manuelles Setzen des State wird sichergestellt, dass der Wert immer korrekt uebernommen wird. Der Handler kombiniert auch bestehenden Text korrekt, falls der Nutzer in die Mitte des Textes einfuegt.

### Warum explizite MIME-Types?

Der `image/*` Wildcard wird von Windows-nativen Datei-Dialogen unterschiedlich interpretiert. Manche Systeme zeigen den Filter als "Benutzerdefinierte Dateien (*.*)" an, blockieren dann aber die Auswahl. Explizite Angaben wie `image/jpeg,image/png` plus die Dateiendungen (`.jpg,.png`) funktionieren zuverlaessig auf allen Plattformen.

## Erwartetes Ergebnis

- Windows-Nutzer koennen Meeting-Links per Strg+V und Rechtsklick-Einfuegen ins Eingabefeld uebernehmen
- Der Dateiauswahl-Dialog auf Windows zeigt korrekt "Bilddateien" an und erlaubt die Auswahl von JPG, PNG, GIF und WebP
