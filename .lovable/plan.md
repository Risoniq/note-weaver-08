

## "Fertig"-Badge im Header entfernen

Der tuerkisfarbene "Fertig"-Badge neben dem "Transkript neu laden"-Button im Header der Meeting-Detail-Seite wird entfernt.

### Aenderung

**Datei:** `src/pages/MeetingDetail.tsx` (Zeilen 816-819)

Der folgende Badge-Code wird geloescht:

```tsx
<Badge className={`shrink-0 px-4 py-1.5 text-sm rounded-full ${getStatusColor(recording.status)}`}>
  {getStatusLabel(recording.status)}
  {isSyncing && <RefreshCw className="h-3 w-3 ml-1.5 animate-spin inline" />}
</Badge>
```

Das ist eine minimale Aenderung - nur diese 4 Zeilen werden entfernt. Alle anderen Funktionen bleiben unberuehrt.

