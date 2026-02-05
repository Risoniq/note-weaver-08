import { useState } from 'react';
import { Key, Copy, Check, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface CreateApiKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateKey: (data: { name: string; permissions: any; expires_at: string | null }) => Promise<{ api_key: string } | null>;
  isCreating: boolean;
}

export const CreateApiKeyDialog = ({ open, onOpenChange, onCreateKey, isCreating }: CreateApiKeyDialogProps) => {
  const [name, setName] = useState('');
  const [dashboardPermission, setDashboardPermission] = useState(true);
  const [transcriptsPermission, setTranscriptsPermission] = useState(true);
  const [teamStatsPermission, setTeamStatsPermission] = useState(true);
  const [importPermission, setImportPermission] = useState(false);
  const [updatePermission, setUpdatePermission] = useState(false);
  const [webhookReceivePermission, setWebhookReceivePermission] = useState(false);
  const [expiresIn, setExpiresIn] = useState<string>('never');
  
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const resetForm = () => {
    setName('');
    setDashboardPermission(true);
    setTranscriptsPermission(true);
    setTeamStatsPermission(true);
    setImportPermission(false);
    setUpdatePermission(false);
    setWebhookReceivePermission(false);
    setExpiresIn('never');
    setCreatedKey(null);
    setCopied(false);
  };

  const handleClose = () => {
    if (createdKey) {
      // Warn user if they haven't copied the key
      if (!copied && !confirm('Der API-Key wurde noch nicht kopiert. Wirklich schließen? Der Key kann nicht mehr angezeigt werden.')) {
        return;
      }
    }
    resetForm();
    onOpenChange(false);
  };

  const handleCreate = async () => {
    let expiresAt: string | null = null;
    if (expiresIn !== 'never') {
      const date = new Date();
      switch (expiresIn) {
        case '30d':
          date.setDate(date.getDate() + 30);
          break;
        case '90d':
          date.setDate(date.getDate() + 90);
          break;
        case '1y':
          date.setFullYear(date.getFullYear() + 1);
          break;
      }
      expiresAt = date.toISOString();
    }

    const result = await onCreateKey({
      name,
      permissions: {
        dashboard: dashboardPermission,
        transcripts: transcriptsPermission,
        team_stats: teamStatsPermission,
        import: importPermission,
        update: updatePermission,
        webhook_receive: webhookReceivePermission,
      },
      expires_at: expiresAt,
    });

    if (result?.api_key) {
      setCreatedKey(result.api_key);
    }
  };

  const handleCopy = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey);
      setCopied(true);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            {createdKey ? 'API-Key erstellt' : 'Neuer API-Key'}
          </DialogTitle>
          <DialogDescription>
            {createdKey 
              ? 'Kopiere den Key jetzt. Er wird nur einmal angezeigt!'
              : 'Erstelle einen neuen API-Key für externe Systeme.'
            }
          </DialogDescription>
        </DialogHeader>

        {createdKey ? (
          <div className="space-y-4">
            <Alert className="bg-amber-50 border-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                Dies ist das einzige Mal, dass der vollständige API-Key angezeigt wird. 
                Kopiere ihn jetzt und speichere ihn sicher!
              </AlertDescription>
            </Alert>

            <div className="flex items-center gap-2 bg-muted rounded-md p-3">
              <code className="text-sm font-mono flex-1 break-all">{createdKey}</code>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={handleCopy}
                className={copied ? 'text-green-600' : ''}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>

            {copied && (
              <p className="text-sm text-green-600 text-center">
                ✓ In die Zwischenablage kopiert
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="z.B. Slack Export, CRM Integration"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-4">
              <div className="space-y-3">
                <Label className="text-muted-foreground text-xs uppercase tracking-wide">Lesen (Daten abrufen)</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="perm-dashboard" 
                      checked={dashboardPermission}
                      onCheckedChange={(checked) => setDashboardPermission(checked === true)}
                    />
                    <label htmlFor="perm-dashboard" className="text-sm cursor-pointer">
                      Dashboard-Daten (Benutzer, Statistiken)
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="perm-transcripts" 
                      checked={transcriptsPermission}
                      onCheckedChange={(checked) => setTranscriptsPermission(checked === true)}
                    />
                    <label htmlFor="perm-transcripts" className="text-sm cursor-pointer">
                      Transkripte (Inhalte, Analysen)
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="perm-teamstats" 
                      checked={teamStatsPermission}
                      onCheckedChange={(checked) => setTeamStatsPermission(checked === true)}
                    />
                    <label htmlFor="perm-teamstats" className="text-sm cursor-pointer">
                      Team-Statistiken
                    </label>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <Label className="text-muted-foreground text-xs uppercase tracking-wide">Schreiben (Daten empfangen)</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="perm-import" 
                      checked={importPermission}
                      onCheckedChange={(checked) => setImportPermission(checked === true)}
                    />
                    <label htmlFor="perm-import" className="text-sm cursor-pointer">
                      Transkripte importieren
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="perm-update" 
                      checked={updatePermission}
                      onCheckedChange={(checked) => setUpdatePermission(checked === true)}
                    />
                    <label htmlFor="perm-update" className="text-sm cursor-pointer">
                      Recordings aktualisieren
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="perm-webhook-receive" 
                      checked={webhookReceivePermission}
                      onCheckedChange={(checked) => setWebhookReceivePermission(checked === true)}
                    />
                    <label htmlFor="perm-webhook-receive" className="text-sm cursor-pointer">
                      Webhook-Callbacks empfangen
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expires">Ablaufdatum</Label>
              <Select value={expiresIn} onValueChange={setExpiresIn}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="never">Kein Ablauf</SelectItem>
                  <SelectItem value="30d">30 Tage</SelectItem>
                  <SelectItem value="90d">90 Tage</SelectItem>
                  <SelectItem value="1y">1 Jahr</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter>
          {createdKey ? (
            <Button onClick={handleClose} className="w-full">
              {copied ? 'Schließen' : 'Schließen (Key nicht kopiert!)'}
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>
                Abbrechen
              </Button>
              <Button 
                onClick={handleCreate} 
              disabled={!name.trim() || isCreating || (!dashboardPermission && !transcriptsPermission && !teamStatsPermission && !importPermission && !updatePermission && !webhookReceivePermission)}
              >
                {isCreating ? 'Erstelle...' : 'API-Key erstellen'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
