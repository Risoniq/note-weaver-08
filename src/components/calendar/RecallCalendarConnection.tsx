import { Link2Off, RefreshCw, AlertCircle, Chrome, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import type { GoogleCalendarStatus } from '@/hooks/useGoogleRecallCalendar';
import type { MicrosoftCalendarStatus } from '@/hooks/useMicrosoftRecallCalendar';
interface RecallCalendarConnectionProps {
  // Google
  googleStatus: GoogleCalendarStatus;
  googleError: string | null;
  googleConnected: boolean;
  googlePendingOauthUrl: string | null;
  googleIsLoading: boolean;
  onConnectGoogle: () => void;
  onDisconnectGoogle: () => void;
  onCheckGoogleStatus: () => void;
  // Microsoft
  microsoftStatus: MicrosoftCalendarStatus;
  microsoftError: string | null;
  microsoftConnected: boolean;
  microsoftPendingOauthUrl: string | null;
  microsoftIsLoading: boolean;
  onConnectMicrosoft: () => void;
  onDisconnectMicrosoft: () => void;
  onCheckMicrosoftStatus: () => void;
  // Shared
  onRefreshMeetings: () => void;
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
  status: GoogleCalendarStatus | MicrosoftCalendarStatus;
  isLoading: boolean;
  error: string | null;
  pendingOauthUrl: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
  onCheckStatus: () => void;
  onRefresh: () => void;
  isImpersonating: boolean;
}

const CalendarCard = ({
  title,
  icon,
  connected,
  status,
  isLoading,
  error,
  pendingOauthUrl,
  onConnect,
  onDisconnect,
  onCheckStatus,
  onRefresh,
  isImpersonating,
}: CalendarCardProps) => {
  const isConnecting = status === 'connecting';
  const isSyncing = status === 'syncing';

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
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
              disabled={isImpersonating}
              className="gradient-hero"
            >
              Verbinden
            </Button>
          )}
        </div>
      </div>

      {/* Connecting state with fallback options */}
      {isConnecting && (
        <div className="p-3 bg-blue-500/10 rounded-lg space-y-2">
          <div className="flex items-start gap-2">
            <RefreshCw size={16} className="text-blue-500 animate-spin mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-blue-600 dark:text-blue-400">
                Warte auf Anmeldung...
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={onCheckStatus} disabled={isLoading}>
              <RefreshCw size={14} className={`mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
              Status prüfen
            </Button>
            
            {pendingOauthUrl && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const width = 600;
                  const height = 700;
                  const left = Math.max(0, (window.screen.width - width) / 2);
                  const top = Math.max(0, (window.screen.height - height) / 2);
                  window.open(pendingOauthUrl, '_blank', `width=${width},height=${height},left=${left},top=${top}`);
                }}
              >
                Popup erneut öffnen
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Error display */}
      {status === 'error' && error && (
        <div className="p-3 bg-destructive/10 rounded-lg flex items-start gap-2">
          <AlertCircle size={16} className="text-destructive mt-0.5 flex-shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
    </div>
  );
};

export const RecallCalendarConnection = ({
  googleStatus,
  googleError,
  googleConnected,
  googlePendingOauthUrl,
  googleIsLoading,
  onConnectGoogle,
  onDisconnectGoogle,
  onCheckGoogleStatus,
  microsoftStatus,
  microsoftError,
  microsoftConnected,
  microsoftPendingOauthUrl,
  microsoftIsLoading,
  onConnectMicrosoft,
  onDisconnectMicrosoft,
  onCheckMicrosoftStatus,
  onRefreshMeetings,
}: RecallCalendarConnectionProps) => {
  const { isImpersonating } = useImpersonation();

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground mb-2">Kalender-Integration</h3>
      
      {/* Impersonation Warning */}
      {isImpersonating && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Kalender-Verbindungen können nicht während der Impersonation hergestellt werden. 
            Der Benutzer muss sich selbst mit Microsoft/Google anmelden.
          </AlertDescription>
        </Alert>
      )}
      
      {/* Google Calendar Card */}
      <CalendarCard
        title="Google Kalender"
        icon={<Chrome size={20} />}
        connected={googleConnected}
        status={googleStatus}
        isLoading={googleIsLoading}
        error={googleError}
        pendingOauthUrl={googlePendingOauthUrl}
        onConnect={onConnectGoogle}
        onDisconnect={onDisconnectGoogle}
        onCheckStatus={onCheckGoogleStatus}
        onRefresh={onRefreshMeetings}
        isImpersonating={isImpersonating}
      />

      {/* Microsoft Calendar Card */}
      <CalendarCard
        title="Microsoft Kalender"
        icon={<MicrosoftIcon size={20} />}
        connected={microsoftConnected}
        status={microsoftStatus}
        isLoading={microsoftIsLoading}
        error={microsoftError}
        pendingOauthUrl={microsoftPendingOauthUrl}
        onConnect={onConnectMicrosoft}
        onDisconnect={onDisconnectMicrosoft}
        onCheckStatus={onCheckMicrosoftStatus}
        onRefresh={onRefreshMeetings}
        isImpersonating={isImpersonating}
      />
    </div>
  );
};
