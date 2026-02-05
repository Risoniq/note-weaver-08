import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { Key, Trash2, Webhook, Clock, Shield, Copy, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export interface ApiKeyData {
  id: string;
  name: string;
  key_prefix: string;
  permissions: {
    dashboard?: boolean;
    transcripts?: boolean;
    team_stats?: boolean;
    import?: boolean;
    update?: boolean;
    webhook_receive?: boolean;
  };
  created_by: string;
  last_used_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  webhooks?: WebhookData[];
}

export interface WebhookData {
  id: string;
  api_key_id: string;
  name: string;
  webhook_url: string;
  frequency: string;
  schedule_time: string | null;
  schedule_day: number | null;
  threshold_type: string | null;
  threshold_value: number | null;
  report_type: string;
  is_active: boolean;
  last_triggered: string | null;
  created_at: string;
}

interface ApiKeyCardProps {
  apiKey: ApiKeyData;
  onDelete: (keyId: string) => void;
  onConfigureWebhook: (apiKey: ApiKeyData) => void;
  isDeleting?: boolean;
}

export const ApiKeyCard = ({ apiKey, onDelete, onConfigureWebhook, isDeleting }: ApiKeyCardProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopyPrefix = () => {
    navigator.clipboard.writeText(apiKey.key_prefix);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getReadPermissionBadges = () => {
    const badges: React.ReactNode[] = [];
    if (apiKey.permissions.dashboard) {
      badges.push(<Badge key="dashboard" variant="secondary" className="text-xs">Dashboard</Badge>);
    }
    if (apiKey.permissions.transcripts) {
      badges.push(<Badge key="transcripts" variant="secondary" className="text-xs">Transkripte</Badge>);
    }
    if (apiKey.permissions.team_stats) {
      badges.push(<Badge key="team_stats" variant="secondary" className="text-xs">Team-Stats</Badge>);
    }
    return badges;
  };

  const getWritePermissionBadges = () => {
    const badges: React.ReactNode[] = [];
    if (apiKey.permissions.import) {
      badges.push(<Badge key="import" variant="outline" className="text-xs border-green-500 text-green-600">Import</Badge>);
    }
    if (apiKey.permissions.update) {
      badges.push(<Badge key="update" variant="outline" className="text-xs border-blue-500 text-blue-600">Update</Badge>);
    }
    if (apiKey.permissions.webhook_receive) {
      badges.push(<Badge key="webhook_receive" variant="outline" className="text-xs border-purple-500 text-purple-600">Webhook</Badge>);
    }
    return badges;
  };

  const isExpired = apiKey.expires_at && new Date(apiKey.expires_at) < new Date();
  const readBadges = getReadPermissionBadges();
  const writeBadges = getWritePermissionBadges();

  return (
    <Card className={!apiKey.is_active || isExpired ? 'opacity-60' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{apiKey.name}</CardTitle>
          </div>
          <div className="flex items-center gap-1">
            {!apiKey.is_active && (
              <Badge variant="destructive" className="text-xs">Deaktiviert</Badge>
            )}
            {isExpired && (
              <Badge variant="destructive" className="text-xs">Abgelaufen</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Key Prefix */}
        <div className="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-2">
          <code className="text-sm font-mono flex-1">{apiKey.key_prefix}</code>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCopyPrefix}>
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>

        {/* Permissions */}
        <div className="space-y-2">
          {readBadges.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-xs text-muted-foreground mr-1">Lesen:</span>
              {readBadges}
            </div>
          )}
          {writeBadges.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-xs text-muted-foreground mr-1">Schreiben:</span>
              {writeBadges}
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className="text-sm text-muted-foreground space-y-1">
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3" />
            <span>
              Erstellt: {new Date(apiKey.created_at).toLocaleDateString('de-DE')}
            </span>
          </div>
          {apiKey.last_used_at && (
            <div className="flex items-center gap-2">
              <Shield className="h-3 w-3" />
              <span>
                Zuletzt genutzt: {formatDistanceToNow(new Date(apiKey.last_used_at), { addSuffix: true, locale: de })}
              </span>
            </div>
          )}
          {apiKey.expires_at && (
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3" />
              <span className={isExpired ? 'text-destructive' : ''}>
                {isExpired ? 'Abgelaufen' : 'Läuft ab'}: {new Date(apiKey.expires_at).toLocaleDateString('de-DE')}
              </span>
            </div>
          )}
        </div>

        {/* Webhooks info */}
        {apiKey.webhooks && apiKey.webhooks.length > 0 && (
          <div className="pt-2 border-t">
            <div className="text-sm text-muted-foreground mb-2">
              {apiKey.webhooks.length} Webhook{apiKey.webhooks.length !== 1 ? 's' : ''} konfiguriert
            </div>
            <div className="space-y-1">
              {apiKey.webhooks.map(wh => (
                <div key={wh.id} className="flex items-center gap-2 text-xs">
                  <Webhook className="h-3 w-3" />
                  <span className="truncate">{wh.name}</span>
                  <Badge variant={wh.is_active ? 'default' : 'secondary'} className="text-xs ml-auto">
                    {wh.frequency === 'manual' ? 'Manuell' : 
                     wh.frequency === 'daily' ? 'Täglich' : 
                     wh.frequency === 'weekly' ? 'Wöchentlich' : 
                     wh.frequency}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={() => onConfigureWebhook(apiKey)}
          >
            <Webhook className="h-4 w-4 mr-2" />
            Webhook
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={isDeleting}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>API-Key löschen?</AlertDialogTitle>
                <AlertDialogDescription>
                  Möchtest du den API-Key <strong>{apiKey.name}</strong> wirklich löschen?
                  Alle damit verbundenen Webhooks werden ebenfalls gelöscht.
                  Externe Systeme können diesen Key nicht mehr verwenden.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(apiKey.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Endgültig löschen
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
};
