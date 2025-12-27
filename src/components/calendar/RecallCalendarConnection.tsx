import { Calendar, Link2Off, RefreshCw, AlertCircle, Chrome, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CalendarStatus } from '@/hooks/useRecallCalendar';

interface RecallCalendarConnectionProps {
  status: CalendarStatus;
  error: string | null;
  googleConnected: boolean;
  microsoftConnected: boolean;
  onConnectGoogle: () => void;
  onConnectMicrosoft: () => void;
  onDisconnectGoogle: () => void;
  onDisconnectMicrosoft: () => void;
  onRefresh: () => void;
  onRepair?: (targetId: string) => Promise<boolean>;
  isLoading: boolean;
  needsRepair?: boolean;
  recallUserId?: string | null;
}

// Microsoft icon component
const MicrosoftIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
    <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
    <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
    <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
  </svg>
);

interface CalendarCardProps {
  title: string;
  icon: React.ReactNode;
  connected: boolean;
  isConnecting: boolean;
  isSyncing: boolean;
  isLoading: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onRefresh: () => void;
}

const CalendarCard = ({
  title,
  icon,
  connected,
  isConnecting,
  isSyncing,
  isLoading,
  onConnect,
  onDisconnect,
  onRefresh,
}: CalendarCardProps) => {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${
            connected 
              ? 'bg-green-500/10 text-green-500' 
              : isSyncing
              ? 'bg-yellow-500/10 text-yellow-500'
              : 'bg-muted text-muted-foreground'
          }`}>
            {icon}
          </div>
          <div>
            <h3 className="font-medium text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground">
              {isSyncing 
                ? 'Wird synchronisiert...' 
                : isConnecting 
                ? 'Verbindung wird hergestellt...' 
                : connected 
                ? 'Verbunden' 
                : 'Nicht verbunden'}
            </p>
            {connected && (
              <p className="text-xs text-green-500 mt-1">
                ✓ Bot tritt automatisch allen Meetings bei
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {connected ? (
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
          ) : isConnecting || isSyncing ? (
            <Button variant="ghost" size="sm" disabled>
              <RefreshCw size={16} className="mr-1 animate-spin" />
              {isSyncing ? 'Synchronisieren...' : 'Verbinden...'}
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={onConnect}
              className="gradient-hero"
            >
              Verbinden
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export const RecallCalendarConnection = ({
  status,
  error,
  googleConnected,
  microsoftConnected,
  onConnectGoogle,
  onConnectMicrosoft,
  onDisconnectGoogle,
  onDisconnectMicrosoft,
  onRefresh,
  onRepair,
  isLoading,
  needsRepair,
  recallUserId,
}: RecallCalendarConnectionProps) => {
  const isConnecting = status === 'connecting';
  const isSyncing = status === 'syncing';

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground mb-2">Kalender-Integration</h3>
      
      {/* Google Calendar Card */}
      <CalendarCard
        title="Google Kalender"
        icon={<Chrome size={20} />}
        connected={googleConnected}
        isConnecting={isConnecting && !googleConnected}
        isSyncing={isSyncing && !googleConnected}
        isLoading={isLoading}
        onConnect={onConnectGoogle}
        onDisconnect={onDisconnectGoogle}
        onRefresh={onRefresh}
      />

      {/* Microsoft Calendar Card */}
      <CalendarCard
        title="Microsoft Kalender"
        icon={<MicrosoftIcon size={20} />}
        connected={microsoftConnected}
        isConnecting={isConnecting && !microsoftConnected}
        isSyncing={isSyncing && !microsoftConnected}
        isLoading={isLoading}
        onConnect={onConnectMicrosoft}
        onDisconnect={onDisconnectMicrosoft}
        onRefresh={onRefresh}
      />

      {/* Repair hint - only show if repair is possible */}
      {needsRepair && onRepair && recallUserId && (
        <div className="p-3 bg-yellow-500/10 rounded-lg flex items-start gap-2">
          <Wrench size={16} className="text-yellow-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-yellow-600 dark:text-yellow-400">
              Mögliche Verbindungs-Inkonsistenz erkannt.
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2"
              onClick={() => onRepair(recallUserId)}
              disabled={isLoading}
            >
              <Wrench size={14} className="mr-1" />
              Verbindung reparieren
            </Button>
          </div>
        </div>
      )}

      {status === 'error' && error && (
        <div className="p-3 bg-destructive/10 rounded-lg flex items-start gap-2">
          <AlertCircle size={16} className="text-destructive mt-0.5 flex-shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
    </div>
  );
};
