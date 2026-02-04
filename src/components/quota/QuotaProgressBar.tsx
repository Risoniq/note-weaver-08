import { Progress } from "@/components/ui/progress";
import { Clock, Users } from "lucide-react";
import type { UserQuota } from "@/hooks/useUserQuota";

interface QuotaProgressBarProps {
  quota: UserQuota;
}

export function QuotaProgressBar({ quota }: QuotaProgressBarProps) {
  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h`;
    return `${mins}m`;
  };

  const getBarColor = () => {
    if (quota.percentage_used >= 100) return 'bg-destructive';
    if (quota.percentage_used >= 80) return 'bg-amber-500';
    return 'bg-primary';
  };

  const getTextColor = () => {
    if (quota.percentage_used >= 100) return 'text-destructive';
    if (quota.percentage_used >= 80) return 'text-amber-600 dark:text-amber-400';
    return 'text-foreground';
  };

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {quota.is_team_quota ? (
            <>
              <Users className="h-4 w-4" />
              <span>Team-Kontingent{quota.team_name ? `: ${quota.team_name}` : ''}</span>
            </>
          ) : (
            <>
              <Clock className="h-4 w-4" />
              <span>Meeting-Kontingent</span>
            </>
          )}
        </div>
        <span className={`text-sm font-medium ${getTextColor()}`}>
          {formatTime(quota.used_minutes)} / {formatTime(quota.max_minutes)}
        </span>
      </div>
      <Progress 
        value={quota.percentage_used} 
        className="h-2"
        indicatorClassName={getBarColor()}
      />
      {quota.is_exhausted && (
        <p className="text-xs text-destructive">
          {quota.is_team_quota 
            ? 'Das Team-Kontingent ist erschöpft. Kontaktiere deinen Admin für mehr Meeting-Stunden.'
            : 'Dein Kontingent ist erschöpft. Upgrade auf die Vollversion für unbegrenzte Meetings.'}
        </p>
      )}
    </div>
  );
}
