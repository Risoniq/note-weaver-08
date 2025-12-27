import { Calendar, Link2Off, RefreshCw, AlertCircle, Chrome } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CalendarStatus } from '@/hooks/useRecallCalendar';

interface RecallCalendarConnectionProps {
  status: CalendarStatus;
  error: string | null;
  googleConnected: boolean;
  microsoftConnected: boolean;
  onConnectGoogle: () => void;
  onConnectMicrosoft: () => void;
  onDisconnect: () => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export const RecallCalendarConnection = ({
  status,
  error,
  googleConnected,
  microsoftConnected,
  onConnectGoogle,
  onConnectMicrosoft,
  onDisconnect,
  onRefresh,
  isLoading,
}: RecallCalendarConnectionProps) => {
  const getStatusText = () => {
    if (status === 'connected') {
      const providers = [];
      if (googleConnected) providers.push('Google');
      if (microsoftConnected) providers.push('Microsoft');
      return `Verbunden mit ${providers.join(' & ')}`;
    }
    if (status === 'connecting') return 'Verbindung wird hergestellt...';
    if (status === 'error') return error || 'Verbindungsfehler';
    return 'Nicht verbunden';
  };

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
            <h3 className="font-medium text-foreground">Kalender-Integration</h3>
            <p className="text-sm text-muted-foreground">
              {getStatusText()}
            </p>
            {status === 'connected' && (
              <p className="text-xs text-green-500 mt-1">
                ✓ Bot tritt automatisch allen Meetings bei
              </p>
            )}
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
            <div className="flex gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={onConnectGoogle}
                className="gradient-hero"
              >
                <Chrome size={16} className="mr-1" />
                Google verbinden
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onConnectMicrosoft}
              >
                Microsoft verbinden
              </Button>
            </div>
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
              onClick={onConnectGoogle}
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
