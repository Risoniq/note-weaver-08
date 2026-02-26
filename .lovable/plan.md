

# Quota-System ueberarbeiten: Individuelle + Team-Kontingente

## Problem

Aktuell gilt: Ist ein User in einem Team, wird **nur** das Team-Kontingent geprueft. Das individuelle Kontingent aus `user_quotas` wird komplett ignoriert. Wenn der Admin einem User wie Christian Keintzel neues Kontingent zuweist, hat das keine Wirkung, weil der Hook direkt zum Team-Zweig springt.

## Neue Logik

Jeder User hat **immer** ein individuelles Kontingent (aus `user_quotas`). Ist er zusaetzlich in einem Team, wird das Team-Kontingent **zusaetzlich** angezeigt. Fuer die Blockierung gilt: **beide** muessen genuegend Restminuten haben — ist eines von beiden erschoepft, wird die Aufnahme blockiert.

## Aenderungen

### 1. `useUserQuota` Hook umbauen

**Neues Interface:**
```text
UserQuota {
  personal: { max_minutes, used_minutes, remaining_minutes, percentage_used, is_exhausted }
  team?: { max_minutes, used_minutes, remaining_minutes, percentage_used, is_exhausted, team_name }
  is_exhausted: boolean  // true wenn personal ODER team erschoepft
}
```

**Neue Logik:**
- Immer `user_quotas` fuer den User laden (individuell)
- Immer eigene `recordings` zaehlen (nur eigene, nicht Team-gesamt)
- Falls User in Team: zusaetzlich Team-Daten laden (Gesamt-Verbrauch aller Mitglieder)
- `is_exhausted` = personal exhausted OR team exhausted

### 2. `QuotaProgressBar` anpassen

- Zeigt immer die individuelle Quota-Bar an ("Dein Kontingent")
- Falls Team vorhanden: zeigt darunter eine zweite Bar ("Team-Kontingent: [Name]")
- Erschoepfungs-Hinweis zeigt an, welches Kontingent erschoepft ist

### 3. Pruefstellen in AppLayout und MeetingNoteTaker

- `quota.is_exhausted` bleibt die zentrale Pruefung — kein Code-Umbau noetig, da das neue Objekt weiterhin `is_exhausted` auf Top-Level hat

## Betroffene Dateien

| Datei | Aenderung |
|---|---|
| `src/hooks/useUserQuota.ts` | Interface aendern, immer individuelle + optionale Team-Quota laden |
| `src/components/quota/QuotaProgressBar.tsx` | Zwei Bars anzeigen (persoenlich + Team) |
| `src/pages/Index.tsx` | Zugriff auf neues Interface anpassen |
| `src/components/layout/AppLayout.tsx` | Zugriff auf neues Interface anpassen |
| `src/components/MeetingNoteTaker.tsx` | Zugriff auf neues Interface anpassen |

