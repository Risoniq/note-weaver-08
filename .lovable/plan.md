

# Doppelte Toast-Benachrichtigungen beheben

## Problem

Das Projekt verwendet **zwei parallele Toast-Systeme** gleichzeitig:

1. **Radix/shadcn Toaster** (`@/components/ui/toaster.tsx` + `@/hooks/use-toast.ts`) — mit `TOAST_LIMIT = 1`, kann nur einen Toast gleichzeitig zeigen
2. **Sonner** (`@/components/ui/sonner.tsx` + `import { toast } from 'sonner'`) — eigenes Stacking-System

Beide Toaster werden in `App.tsx` gerendert (Zeile 36-37). Verschiedene Komponenten nutzen unterschiedliche Systeme — manche importieren `toast` aus `@/hooks/use-toast`, andere aus `sonner`. Wenn beide Systeme gleichzeitig feuern (z.B. beim Recording-Start), erscheinen doppelte Meldungen in verschiedenen Ecken.

Zusaetzlich hat das Radix-System `TOAST_LIMIT = 1` und einen extrem langen `TOAST_REMOVE_DELAY = 1000000` (ca. 16 Minuten), was dazu fuehrt, dass alte Toasts nicht verschwinden und neue Toasts alte sofort ersetzen statt zu stacken.

## Loesung: Auf ein einziges Toast-System vereinheitlichen

**Sonner** wird als alleiniges System beibehalten, da es nativ Stacking unterstuetzt, automatische Timeouts hat und bereits von der Mehrheit der Komponenten genutzt wird.

### Schritt 1: Radix-Toaster aus App.tsx entfernen

Die Zeile `<Toaster />` (Radix) wird entfernt. Nur `<Sonner />` bleibt.

### Schritt 2: Alle `@/hooks/use-toast` Importe auf Sonner umstellen

Alle Dateien, die `toast` oder `useToast` aus `@/hooks/use-toast` importieren, werden auf `import { toast } from 'sonner'` umgestellt. Die Sonner-API unterscheidet sich leicht:

```text
// Vorher (Radix):
toast({ title: 'Titel', description: 'Beschreibung', variant: 'destructive' })

// Nachher (Sonner):
toast.error('Beschreibung')          // fuer destructive
toast.success('Beschreibung')        // fuer Erfolg
toast('Beschreibung')                // fuer neutral
toast('Titel', { description: '…' }) // mit Beschreibung
```

### Schritt 3: Sonner-Konfiguration fuer Stacking

In der Sonner-Komponente wird `visibleToasts={5}` gesetzt, damit bis zu 5 verschiedene Toasts gleichzeitig sichtbar sind und sich vertikal stacken. Position bleibt `bottom-right`.

## Betroffene Dateien

| Datei | Aenderung |
|---|---|
| `src/App.tsx` | `<Toaster />` (Radix) entfernen, nur Sonner behalten |
| `src/components/ui/sonner.tsx` | `visibleToasts={5}` und `position="bottom-right"` hinzufuegen |
| `src/contexts/QuickRecordingContext.tsx` | `toast` Import von `@/hooks/use-toast` auf `sonner` umstellen, alle Aufrufe anpassen |
| `src/hooks/useMeetingBotWebhook.ts` | `useToast` auf Sonner umstellen |
| `src/components/MeetingBot.tsx` | `useToast` auf Sonner umstellen |
| `src/components/dashboard/MeetingChatWidget.tsx` | `useToast` auf Sonner umstellen |
| `src/components/meeting/MeetingChatWidget.tsx` | `useToast` auf Sonner umstellen |
| `src/components/meeting/MeetingDetailModal.tsx` | `useToast` auf Sonner umstellen |
| `src/components/calendar/QuickMeetingJoin.tsx` | `toast` Import von `@/hooks/use-toast` auf `sonner` umstellen |
| `src/hooks/useMeetingReminders.ts` | `useToast` auf Sonner umstellen |
| `src/components/admin/WebhookConfigDialog.tsx` | `useToast` auf Sonner umstellen |
| `src/components/projects/ProjectChatWidget.tsx` | `useToast` auf Sonner umstellen |
| Weitere Dateien mit `@/hooks/use-toast` | Gleiche Umstellung |

### Sonner Deduplizierung

Sonner hat eingebaute Deduplizierung: Wenn `toast.error('Gleiche Nachricht')` mehrfach schnell hintereinander aufgerufen wird, zeigt es nur einen Toast. Fuer zusaetzlichen Schutz wird in haeufig feuernden Stellen (z.B. QuickRecordingContext) eine `toast.dismiss()` vor dem neuen Toast aufgerufen oder die Sonner `id`-Option genutzt:

```text
toast.success('Aufnahme gestartet', { id: 'recording-start' })
// Wird mit gleicher ID nie doppelt angezeigt
```

## Technische Details

### Sonner API-Mapping

```text
Radix-Aufruf                              → Sonner-Aufruf
──────────────────────────────────────────────────────────
toast({ title, description })              → toast(title, { description })
toast({ title, variant: 'destructive' })   → toast.error(title)
toast({ title, description, variant: 'destructive' }) → toast.error(title, { description })
useToast() → const { toast } = ...         → import { toast } from 'sonner' (kein Hook noetig)
```

### Kein Breaking Change

- Die Sonner-Komponente und viele Dateien nutzen bereits `sonner`
- Die Radix-Toast UI-Dateien (`toast.tsx`, `toaster.tsx`, `use-toast.ts`) koennen bestehen bleiben, werden aber nicht mehr gerendert/importiert

