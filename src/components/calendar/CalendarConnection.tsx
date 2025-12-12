import { Calendar, Link2, Link2Off, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CalendarConnectionStatus } from '@/types/calendar';

interface CalendarConnectionProps {
  status: CalendarConnectionStatus;
  error: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export const CalendarConnection = ({
  status,
  error,
  onConnect,
  onDisconnect,
  onRefresh,
  isLoading,
}: CalendarConnectionProps) => {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${
            status === 'connected' 
              ? 'bg-green-500/10 text-green-500' 
              : status === 'error'
              ? 'bg-destructive/10 text-destructive'
              : 'bg-muted text-muted-foreground'
          }`}>
            <Calendar size={20} />
          </div>
          <div>
            <h3 className="font-medium text-foreground">Google Kalender</h3>
            <p className="text-sm text-muted-foreground">
              {status === 'connected' && 'Verbunden'}
              {status === 'connecting' && 'Verbindung wird hergestellt...'}
              {status === 'disconnected' && 'Nicht verbunden'}
              {status === 'error' && (error || 'Verbindungsfehler')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {status === 'connected' && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={onRefresh}
                disabled={isLoading}
                className="h-8 w-8"
              >
                <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDisconnect}
                className="text-muted-foreground hover:text-destructive"
              >
                <Link2Off size={16} className="mr-1" />
                Trennen
              </Button>
            </>
          )}

          {status === 'disconnected' && (
            <Button
              variant="default"
              size="sm"
              onClick={onConnect}
              className="gradient-hero"
            >
              <Link2 size={16} className="mr-1" />
              Verbinden
            </Button>
          )}

          {status === 'connecting' && (
            <Button variant="ghost" size="sm" disabled>
              <RefreshCw size={16} className="mr-1 animate-spin" />
              Verbinden...
            </Button>
          )}

          {status === 'error' && (
            <Button
              variant="default"
              size="sm"
              onClick={onConnect}
              className="gradient-hero"
            >
              <RefreshCw size={16} className="mr-1" />
              Erneut verbinden
            </Button>
          )}
        </div>
      </div>

      {status === 'error' && error && (
        <div className="mt-3 p-2 bg-destructive/10 rounded-lg flex items-start gap-2">
          <AlertCircle size={16} className="text-destructive mt-0.5 flex-shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
    </div>
  );
};
