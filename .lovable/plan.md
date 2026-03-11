

# Blackscreen und fehlerhafte Anzeigen beim Laden

## Identifizierte Probleme

### 1. OnboardingTour blockiert den gesamten Bildschirm
Die `OnboardingTour`-Komponente (z-index 9999) rendert auf **allen Routen** -- auch auf `/auth`, `/admin`, `/recordings` etc. Wenn die Tour aktiv wird aber die Ziel-Elemente nicht gefunden werden (weil der User nicht auf dem Dashboard ist), bleibt ein **schwarzes Overlay** (60% Opacity) über dem gesamten Bildschirm stehen. Das ist die wahrscheinlichste Ursache fuer den Blackscreen.

### 2. Z-Index-Konflikte zwischen Overlays
Drei Komponenten kaempfen um z-index 9999:
- `OnboardingTour` -- `fixed inset-0 z-[9999]` mit `pointer-events-auto`
- `ScreenBorderOverlay` -- `fixed inset-0 z-[9999]`
- `RecordingBanner` -- z-[9998]

### 3. Dreifache QuotaExhaustedModal
Das Modal wird an drei Stellen gleichzeitig gerendert: `Index.tsx`, `AppLayout.tsx`, `MeetingNoteTaker.tsx`. Die in `Index.tsx` oeffnet sich automatisch per `useEffect` und ueberlagert den Content.

## Loesung

### Datei: `src/App.tsx`
- `OnboardingTour` nur innerhalb der Dashboard-Route rendern (aus dem globalen Scope entfernen)

### Datei: `src/pages/Index.tsx`
- `OnboardingTour`-Import und Aufruf hierher verschieben (nur auf Dashboard)
- `QuotaExhaustedModal` Auto-Open entfernen (bereits in AppLayout vorhanden via Mic-Button)

### Datei: `src/components/onboarding/OnboardingTour.tsx`
- Fallback einbauen: Wenn `waitForElement` kein Target findet, Tour ueberspringen statt schwarzes Overlay stehen lassen
- Z-Index auf 9990 reduzieren, damit Recording-Overlays Vorrang haben

### Datei: `src/components/recording/ScreenBorderOverlay.tsx`
- Z-Index von 9999 auf 9995 reduzieren (unter Recording-Banner)

