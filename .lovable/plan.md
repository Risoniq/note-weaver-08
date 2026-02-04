
# Fix: Bot-Avatar immer zu JPEG konvertieren

## Das Problem

Der User as@ec-pd.com hat ein PNG-Bild als Bot-Avatar hochgeladen. Recall.ai lehnt das ab mit:
```
"Not a valid JPEG encoded image."
```

**Ursache im Code (Zeile 379 in Settings.tsx):**
```typescript
const fileExt = file.size > maxSize ? 'jpg' : file.name.split('.').pop();
```

Das Bild wird nur konvertiert wenn es groesser als 2MB ist. Kleinere PNGs werden unbearbeitet hochgeladen.

## Die Loesung

Alle hochgeladenen Bilder **immer** zu JPEG konvertieren, unabhaengig von der Groesse.

## Aenderungen

### Datei: src/pages/Settings.tsx

**1. Neue Hilfsfunktion hinzufuegen (nach `compressImage`):**

```typescript
// Convert any image to JPEG format (Recall.ai only accepts JPEG)
const convertToJpeg = (file: File, quality: number = 0.92): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Weisser Hintergrund (wichtig fuer PNGs mit Transparenz)
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      }
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            URL.revokeObjectURL(img.src);
            resolve(blob);
          } else {
            reject(new Error('JPEG-Konvertierung fehlgeschlagen'));
          }
        },
        'image/jpeg',
        quality
      );
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Bild konnte nicht geladen werden'));
    };
    img.src = URL.createObjectURL(file);
  });
};
```

**2. handleAvatarUpload anpassen (Zeilen 354-380):**

```typescript
try {
  const maxSize = 2 * 1024 * 1024; // 2MB
  let uploadFile: Blob;
  
  // IMMER zu JPEG konvertieren (Recall.ai akzeptiert nur JPEG)
  if (file.size > maxSize) {
    toast({
      title: "Bild wird komprimiert...",
      description: "Das Bild wird auf unter 2MB verkleinert",
    });
    uploadFile = await compressImage(file, maxSize);
  } else {
    // Kleinere Bilder trotzdem zu JPEG konvertieren
    uploadFile = await convertToJpeg(file);
  }
  
  // ... rest of code ...
  
  // Dateiendung ist IMMER .jpg
  const filePath = `${user.id}/bot-avatar-${Date.now()}.jpg`;
```

## Warum dieser Ansatz?

| Aspekt | Erklaerung |
|--------|------------|
| Recall.ai Kompatibilitaet | API akzeptiert nur JPEG fuer `automatic_video_output` |
| Transparenz-Handling | Weisser Hintergrund ersetzt PNG-Transparenz |
| Qualitaet | 92% JPEG-Qualitaet ist visuell fast verlustfrei |
| Kompression | Bleibt unveraendert fuer grosse Bilder (>2MB) |

## Testplan

1. PNG-Bild (klein, unter 2MB) hochladen
2. Pruefen dass Datei als `.jpg` im Storage landet
3. Bot zu Meeting senden
4. Kein "Not a valid JPEG" Fehler mehr

## Sofortloesung fuer betroffenen User

Bis der Fix deployed ist:
1. Aktuelles Avatar-Bild in Einstellungen entfernen
2. Das Bild manuell als JPEG speichern (z.B. in Paint/Preview oeffnen und als .jpg exportieren)
3. JPEG-Version neu hochladen
