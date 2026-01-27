import { AlertCircle, AlertTriangle, Info, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SpeakerQualityResult } from '@/utils/speakerQuality';

interface SpeakerQualityBannerProps {
  quality: SpeakerQualityResult;
  onEditClick: () => void;
  className?: string;
}

export const SpeakerQualityBanner = ({
  quality,
  onEditClick,
  className,
}: SpeakerQualityBannerProps) => {
  // Zeige kein Banner wenn alles in Ordnung ist
  if (quality.status === 'good') {
    return null;
  }

  const statusConfig = {
    critical: {
      icon: AlertCircle,
      bgClass: 'bg-destructive/10 border-destructive/30',
      textClass: 'text-destructive',
      iconClass: 'text-destructive',
    },
    warning: {
      icon: AlertTriangle,
      bgClass: 'bg-warning/10 border-warning/30',
      textClass: 'text-warning-foreground',
      iconClass: 'text-warning',
    },
    good: {
      icon: Info,
      bgClass: 'bg-primary/10 border-primary/30',
      textClass: 'text-primary',
      iconClass: 'text-primary',
    },
  };

  const config = statusConfig[quality.status];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-4 rounded-2xl border animate-fade-in',
        config.bgClass,
        className
      )}
    >
      <div className={cn('shrink-0 mt-0.5', config.iconClass)}>
        <Icon className="h-5 w-5" />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="space-y-1">
          {quality.issues.map((issue, index) => (
            <p key={index} className={cn('text-sm font-medium', config.textClass)}>
              {issue}
            </p>
          ))}
          {quality.suggestions.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {quality.suggestions[0]}
            </p>
          )}
        </div>
        
        {/* Statistik-Chips */}
        <div className="flex flex-wrap gap-2 mt-3">
          {quality.stats.realNames > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success">
              {quality.stats.realNames} identifiziert
            </span>
          )}
          {quality.stats.genericNames > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-warning/10 text-warning">
              {quality.stats.genericNames} generisch
            </span>
          )}
          {quality.stats.unknownCount > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive">
              {quality.stats.unknownCount} unbekannt
            </span>
          )}
        </div>
      </div>
      
      <Button
        variant="outline"
        size="sm"
        onClick={onEditClick}
        className={cn(
          'shrink-0 rounded-xl transition-all hover:scale-105',
          quality.status === 'critical' && 'border-destructive/50 hover:bg-destructive/10',
          quality.status === 'warning' && 'border-warning/50 hover:bg-warning/10'
        )}
      >
        <Edit3 className="h-4 w-4 mr-2" />
        Namen bearbeiten
      </Button>
    </div>
  );
};
