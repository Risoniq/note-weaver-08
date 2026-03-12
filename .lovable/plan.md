

# Video wird nicht geladen bei Storage-Pfaden

## Problem

Die Aufnahme `08202846-6ab6-4fdd-abdd-3480f32d8137` hat als `video_url` den Wert `storage:audio-uploads:6d4a6b30.../1773222353628.webm`. Das ist ein interner Storage-Pfad, der zuerst in eine signierte URL aufgeloest werden muss, bevor ein `<video>`-Tag ihn abspielen kann.

**`MeetingDetail.tsx`** hat bereits eine `VideoPlayer`-Komponente, die das korrekt macht (Zeile 71-133). **`RecordingDetailSheet.tsx`** hingegen gibt den rohen `storage:`-Pfad direkt an `<video src=...>` weiter (Zeile 111) -- das Video kann so nie laden.

## Loesung

### `src/components/recordings/RecordingDetailSheet.tsx`
- Den rohen `<video src={recording.video_url}>` Block durch eine kleine `VideoPlayer`-Hilfskomponente ersetzen, die `storage:`-Pfade ueber `supabase.storage.createSignedUrl()` aufloest (gleiche Logik wie in MeetingDetail.tsx)
- Auch authenticated URLs (`/storage/v1/object/authenticated/...`) und direkte URLs (S3) korrekt behandeln
- Waehrend der Aufloesung einen Lade-Spinner anzeigen

