import { useState } from 'react';
import { Calendar, Link2Off, RefreshCw, AlertCircle, Chrome, Wrench, Bug, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CalendarStatus } from '@/hooks/useRecallCalendar';
import { toast } from 'sonner';

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
  onCheckStatus: () => void;
  onRepair?: (targetId: string) => Promise<boolean>;
  onDebugConnections?: () => Promise<Record<string, unknown> | null>;
  isLoading: boolean;
  needsRepair?: boolean;
  recallUserId?: string | null;
  pendingOauthUrl?: string | null;
  pendingOauthProvider?: 'google' | 'microsoft' | null;
  debugInfo?: Record<string, unknown> | null;
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
  onCheckStatus,
  onRepair,
  onDebugConnections,
  isLoading,
  needsRepair,
  recallUserId,
  pendingOauthUrl,
  pendingOauthProvider,
  debugInfo,
}: RecallCalendarConnectionProps) => {
  const [showDebug, setShowDebug] = useState(false);
  const [isLoadingDebug, setIsLoadingDebug] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const isConnecting = status === 'connecting';
  const isSyncing = status === 'syncing';

  const handleDebug = async () => {
    if (!onDebugConnections) return;
    setIsLoadingDebug(true);
    try {
      await onDebugConnections();
      setShowDebug(true);
    } finally {
      setIsLoadingDebug(false);
    }
  };

  const copyDebugInfo = () => {
    if (!debugInfo) return;
    const debugBundle = {
      ...debugInfo,
      ui_status: status,
      ui_google_connected: googleConnected,
      ui_microsoft_connected: microsoftConnected,
      copied_at: new Date().toISOString(),
    };
    navigator.clipboard.writeText(JSON.stringify(debugBundle, null, 2));
    setCopied(true);
    toast.success('Debug-Info in Zwischenablage kopiert');
    setTimeout(() => setCopied(false), 2000);
  };

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

      {/* Show manual instructions when connecting (polling in progress) */}
      {isConnecting && (
        <div className="p-4 bg-blue-500/10 rounded-lg space-y-3">
          <div className="flex items-start gap-3">
            <RefreshCw size={18} className="text-blue-500 animate-spin mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                Warte auf Anmeldung...
              </p>
              <p className="text-sm text-blue-600/80 dark:text-blue-400/80 mt-1">
                Ein Login-Popup wurde geöffnet. Bitte schließe es nach der Anmeldung.
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onCheckStatus}
              disabled={isLoading}
            >
              <RefreshCw size={14} className={`mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
              Status prüfen
            </Button>
            
            {pendingOauthUrl && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const width = 600;
                    const height = 700;
                    const left = Math.max(0, (window.screen.width - width) / 2);
                    const top = Math.max(0, (window.screen.height - height) / 2);
                    window.open(pendingOauthUrl, 'recall-calendar-auth', `width=${width},height=${height},left=${left},top=${top}`);
                  }}
                >
                  Popup erneut öffnen
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(pendingOauthUrl, '_blank')}
                >
                  In neuem Tab öffnen
                </Button>
              </>
            )}
          </div>

          {pendingOauthUrl && (
            <p className="text-xs text-blue-600/70 dark:text-blue-400/70">
              Popup blockiert? Nutze die Buttons oben.
            </p>
          )}
        </div>
      )}

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

      {/* Debug Panel */}
      {onDebugConnections && (
        <div className="border-t border-border pt-3 mt-3">
          <div className="flex items-center gap-2 mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDebug}
              disabled={isLoadingDebug}
            >
              <Bug size={14} className={`mr-1.5 ${isLoadingDebug ? 'animate-spin' : ''}`} />
              Debug abrufen
            </Button>
            {debugInfo && (
              <Button
                variant="ghost"
                size="sm"
                onClick={copyDebugInfo}
              >
                {copied ? <Check size={14} className="mr-1.5 text-green-500" /> : <Copy size={14} className="mr-1.5" />}
                {copied ? 'Kopiert!' : 'Debug kopieren'}
              </Button>
            )}
            {showDebug && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDebug(false)}
              >
                Schließen
              </Button>
            )}
          </div>
          
          {showDebug && debugInfo && (
            <div className="p-3 bg-muted/50 rounded-lg text-xs font-mono overflow-auto max-h-48">
              <div className="space-y-1">
                <p><span className="text-muted-foreground">recall_user_id:</span> {String(debugInfo.recall_user_id || 'N/A')}</p>
                <p><span className="text-muted-foreground">local_google:</span> {String(debugInfo.local_google_connected)}</p>
                <p><span className="text-muted-foreground">local_microsoft:</span> {String(debugInfo.local_microsoft_connected)}</p>
                <p className={debugInfo.recall_microsoft_connected ? 'text-green-500' : 'text-destructive'}>
                  <span className="text-muted-foreground">recall_microsoft:</span> {String(debugInfo.recall_microsoft_connected)}
                </p>
                <p className={debugInfo.recall_google_connected ? 'text-green-500' : 'text-destructive'}>
                  <span className="text-muted-foreground">recall_google:</span> {String(debugInfo.recall_google_connected)}
                </p>
                {debugInfo.recall_error && (
                  <p className="text-destructive"><span className="text-muted-foreground">recall_error:</span> {String(debugInfo.recall_error)}</p>
                )}
                <p><span className="text-muted-foreground">timestamp:</span> {String(debugInfo.timestamp)}</p>
              </div>
            </div>
          )}
          
          {showDebug && debugInfo && !debugInfo.recall_microsoft_connected && !debugInfo.recall_google_connected && (
            <div className="mt-2 p-2 bg-yellow-500/10 rounded text-xs text-yellow-700 dark:text-yellow-400">
              <p className="font-medium">Recall.ai zeigt keine Verbindung.</p>
              <p className="mt-1">Mögliche Ursachen:</p>
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                <li>Recall EU Dashboard: MS Client Secret abgelaufen/falsch</li>
                <li>Azure: Admin Consent nicht erteilt</li>
                <li>Azure: Conditional Access blockiert</li>
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
