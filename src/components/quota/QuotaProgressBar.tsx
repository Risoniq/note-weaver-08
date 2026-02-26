import { Progress } from "@/components/ui/progress";
import { Clock, Users } from "lucide-react";
import type { UserQuota, QuotaDetail } from "@/hooks/useUserQuota";

interface QuotaProgressBarProps {
  quota: UserQuota;
}

function formatTime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}

function getBarColor(pct: number) {
  if (pct >= 100) return 'bg-destructive';
  if (pct >= 80) return 'bg-amber-500';
  return 'bg-primary';
}

function getTextColor(pct: number) {
  if (pct >= 100) return 'text-destructive';
  if (pct >= 80) return 'text-amber-600 dark:text-amber-400';
  return 'text-foreground';
}

function SingleBar({ detail, icon, label }: { detail: QuotaDetail; icon: React.ReactNode; label: string }) {
  if (!detail) return null;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        <span className={`text-sm font-medium ${getTextColor(detail.percentage_used)}`}>
          {formatTime(detail.used_minutes)} / {formatTime(detail.max_minutes)}
        </span>
      </div>
      <Progress
        value={detail.percentage_used}
        className="h-2"
        indicatorClassName={getBarColor(detail.percentage_used)}
      />
      {detail.is_exhausted && (
        <p className="text-xs text-destructive">
          Kontingent erschöpft
        </p>
      )}
    </div>
  );
}

export function QuotaProgressBar({ quota }: QuotaProgressBarProps) {
  return (
    <div className="w-full space-y-3">
      <SingleBar
        detail={quota.personal}
        icon={<Clock className="h-4 w-4" />}
        label="Dein Kontingent"
      />
      {quota.team && (
        <SingleBar
          detail={quota.team}
          icon={<Users className="h-4 w-4" />}
          label={`Team-Kontingent: ${quota.team.team_name}`}
        />
      )}
    </div>
  );
}
