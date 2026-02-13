import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { withTokenRefresh } from '@/lib/retryWithTokenRefresh';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import {
  Shield, FileSearch, AlertTriangle, Bell, BellOff, CheckCircle2,
  XCircle, RefreshCw, Loader2, Clock, Download, ChevronDown, ChevronUp,
  Phone, LogIn, LogOut, Share2, Trash2, UserPlus, UserMinus, Settings,
  HardDrive, Wrench,
} from 'lucide-react';

interface AuditLog {
  id: string;
  event_type: string;
  actor_id: string | null;
  actor_email: string | null;
  target_id: string | null;
  target_type: string | null;
  details: any;
  severity: string;
  created_at: string;
}

interface IncidentAlert {
  id: string;
  alert_type: string;
  severity: string;
  message: string;
  details: any;
  acknowledged: boolean;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  created_at: string;
}

interface BackupCheck {
  id: string;
  checked_at: string;
  total_recordings: number;
  backups_found: number;
  backups_missing: number;
  backups_corrupted: number;
  details: any[];
  status: string;
}

const EVENT_ICONS: Record<string, any> = {
  'auth.login': LogIn,
  'auth.logout': LogOut,
  'recording.create': Phone,
  'recording.update': Settings,
  'recording.delete': Trash2,
  'sharing.share': Share2,
  'sharing.unshare': Share2,
  'admin.approve_user': UserPlus,
  'admin.delete_user': UserMinus,
  'admin.set_quota': Settings,
  'backup.integrity_check': HardDrive,
};

const EVENT_LABELS: Record<string, string> = {
  'auth.login': 'Anmeldung',
  'auth.logout': 'Abmeldung',
  'recording.create': 'Aufnahme erstellt',
  'recording.update': 'Aufnahme bearbeitet',
  'recording.delete': 'Aufnahme gelöscht',
  'sharing.share': 'Freigabe erteilt',
  'sharing.unshare': 'Freigabe entfernt',
  'admin.approve_user': 'Benutzer freigeschaltet',
  'admin.delete_user': 'Benutzer gelöscht',
  'admin.set_quota': 'Kontingent geändert',
  'admin.create_team': 'Team erstellt',
  'admin.update_team': 'Team aktualisiert',
  'admin.delete_team': 'Team gelöscht',
  'admin.assign_member': 'Mitglied zugeordnet',
  'backup.integrity_check': 'Backup-Prüfung',
};

const SEVERITY_STYLES: Record<string, string> = {
  info: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  warning: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  critical: 'bg-destructive/10 text-destructive border-destructive/20',
};

export function SecurityDashboard() {
  const [secTab, setSecTab] = useState('audit');
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [alerts, setAlerts] = useState<IncidentAlert[]>([]);
  const [backupChecks, setBackupChecks] = useState<BackupCheck[]>([]);
  const [loading, setLoading] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [runningCheck, setRunningCheck] = useState(false);
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  const [repairingBackups, setRepairingBackups] = useState(false);
  const [repairProgress, setRepairProgress] = useState(0);
  const [repairStatus, setRepairStatus] = useState<string | null>(null);

  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    try {
      const body: any = { action: 'list', limit: 100 };
      if (severityFilter !== 'all') body.severity = severityFilter;
      if (eventFilter !== 'all') body.event_type = eventFilter;

      const res = await withTokenRefresh(() =>
        supabase.functions.invoke('admin-audit-log', { body })
      );
      if (res.data?.success) {
        setLogs(res.data.logs || []);
      }
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [severityFilter, eventFilter]);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await withTokenRefresh(() =>
        supabase.functions.invoke('admin-audit-log', { body: { action: 'get-alerts' } })
      );
      if (res.data?.success) {
        setAlerts(res.data.alerts || []);
      }
    } catch (err) {
      console.error('Error fetching alerts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBackupChecks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await withTokenRefresh(() =>
        supabase.functions.invoke('backup-integrity-check', { body: { action: 'list-checks' } })
      );
      if (res.data?.success) {
        setBackupChecks(res.data.checks || []);
      }
    } catch (err) {
      console.error('Error fetching backup checks:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (secTab === 'audit') fetchAuditLogs();
    else if (secTab === 'incidents') fetchAlerts();
    else if (secTab === 'backups') fetchBackupChecks();
  }, [secTab, fetchAuditLogs, fetchAlerts, fetchBackupChecks]);

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      const res = await withTokenRefresh(() =>
        supabase.functions.invoke('admin-audit-log', {
          body: { action: 'acknowledge-alert', alert_id: alertId },
        })
      );
      if (res.data?.success) {
        toast.success('Alert bestätigt');
        fetchAlerts();
      }
    } catch {
      toast.error('Fehler beim Bestätigen');
    }
  };

  const handleRunBackupCheck = async () => {
    setRunningCheck(true);
    try {
      const res = await withTokenRefresh(() =>
        supabase.functions.invoke('backup-integrity-check', { body: { action: 'run-check' } })
      );
      if (res.data?.success) {
        toast.success(`Prüfung abgeschlossen: ${res.data.check.status}`);
        fetchBackupChecks();
      } else {
        toast.error(res.data?.error || 'Prüfung fehlgeschlagen');
      }
    } catch {
      toast.error('Fehler bei der Backup-Prüfung');
    } finally {
      setRunningCheck(false);
    }
  };

  const handleCreateMissingBackups = async () => {
    setRepairingBackups(true);
    setRepairProgress(0);
    setRepairStatus('Starte Backup-Reparatur...');
    let offset = 0;
    const batchSize = 20;
    let totalCreated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    try {
      while (true) {
        const res = await withTokenRefresh(() =>
          supabase.functions.invoke('repair-all-recordings', {
            body: { action: 'create-missing-backups', batch_size: batchSize, offset },
          })
        );

        if (!res.data?.success) {
          toast.error(res.data?.error || 'Fehler bei der Backup-Reparatur');
          break;
        }

        totalCreated += res.data.created || 0;
        totalSkipped += res.data.skipped || 0;
        totalErrors += res.data.errors || 0;
        const total = res.data.total || 1;
        const processed = Math.min(offset + batchSize, total);
        setRepairProgress(Math.round((processed / total) * 100));
        setRepairStatus(`${processed} von ${total} geprüft – ${totalCreated} erstellt, ${totalSkipped} übersprungen`);

        if (res.data.done) break;
        offset = res.data.nextOffset;
      }

      toast.success(`Backup-Reparatur abgeschlossen: ${totalCreated} erstellt, ${totalSkipped} übersprungen, ${totalErrors} Fehler`);
      // Auto-run integrity check after repair
      handleRunBackupCheck();
    } catch {
      toast.error('Fehler bei der Backup-Reparatur');
    } finally {
      setRepairingBackups(false);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

  const unacknowledgedCount = alerts.filter(a => !a.acknowledged).length;

  return (
    <div className="space-y-4">
      <Tabs value={secTab} onValueChange={setSecTab}>
        <TabsList>
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <FileSearch className="h-4 w-4" />
            Audit-Log
          </TabsTrigger>
          <TabsTrigger value="incidents" className="flex items-center gap-2 relative">
            <AlertTriangle className="h-4 w-4" />
            Incident Response
            {unacknowledgedCount > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                {unacknowledgedCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="backups" className="flex items-center gap-2">
            <HardDrive className="h-4 w-4" />
            Backup-Test
          </TabsTrigger>
        </TabsList>

        {/* AUDIT LOG TAB */}
        <TabsContent value="audit" className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v)}>
              <SelectTrigger className="w-[160px] text-foreground">
                <SelectValue placeholder="Schweregrad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Schweregrade</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warnung</SelectItem>
                <SelectItem value="critical">Kritisch</SelectItem>
              </SelectContent>
            </Select>
            <Select value={eventFilter} onValueChange={(v) => setEventFilter(v)}>
              <SelectTrigger className="w-[200px] text-foreground">
                <SelectValue placeholder="Event-Typ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Events</SelectItem>
                <SelectItem value="auth.login">Anmeldung</SelectItem>
                <SelectItem value="auth.logout">Abmeldung</SelectItem>
                <SelectItem value="recording.create">Aufnahme erstellt</SelectItem>
                <SelectItem value="recording.update">Aufnahme bearbeitet</SelectItem>
                <SelectItem value="recording.delete">Aufnahme gelöscht</SelectItem>
                <SelectItem value="sharing.share">Freigabe erteilt</SelectItem>
                <SelectItem value="sharing.unshare">Freigabe entfernt</SelectItem>
                <SelectItem value="admin.approve_user">Benutzer freigeschaltet</SelectItem>
                <SelectItem value="admin.delete_user">Benutzer gelöscht</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={fetchAuditLogs} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Aktualisieren
            </Button>
          </div>

          <Card>
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Zeitpunkt</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Akteur</TableHead>
                    <TableHead>Ziel</TableHead>
                    <TableHead className="w-[80px]">Schwere</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 5 }).map((_, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        Keine Audit-Einträge vorhanden
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log) => {
                      const Icon = EVENT_ICONS[log.event_type] || Shield;
                      return (
                        <TableRow key={log.id}>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDate(log.created_at)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                              <span className="text-sm">{EVENT_LABELS[log.event_type] || log.event_type}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{log.actor_email || '–'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground truncate max-w-[150px]">
                            {log.target_id ? `${log.target_type}: ${log.target_id.substring(0, 8)}...` : '–'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={SEVERITY_STYLES[log.severity] || ''}>
                              {log.severity === 'info' ? 'Info' : log.severity === 'warning' ? 'Warnung' : 'Kritisch'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </Card>
        </TabsContent>

        {/* INCIDENT RESPONSE TAB */}
        <TabsContent value="incidents" className="space-y-4">
          {/* Documentation Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5" />
                Incident Response Plan
              </CardTitle>
              <CardDescription>Vorgehen bei Sicherheitsvorfällen</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 rounded-lg border bg-muted/30">
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <span className="bg-amber-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">1</span>
                    Erkennung & Meldung
                  </h4>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Automatische Alerts bei verdächtigen Aktivitäten</li>
                    <li>• Massenlöschungen (&gt;5 in 5 Min.)</li>
                    <li>• Ungewöhnliche Admin-Aktivität</li>
                    <li>• Backup-Integritätsfehler</li>
                  </ul>
                </div>
                <div className="p-4 rounded-lg border bg-muted/30">
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <span className="bg-amber-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">2</span>
                    Analyse & Eindämmung
                  </h4>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Audit-Log auf betroffene Aktionen prüfen</li>
                    <li>• Betroffene Benutzer ggf. sperren</li>
                    <li>• Zugangsberechtigungen prüfen</li>
                    <li>• Backup-Status verifizieren</li>
                  </ul>
                </div>
                <div className="p-4 rounded-lg border bg-muted/30">
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <span className="bg-amber-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">3</span>
                    Behebung & Nachbereitung
                  </h4>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Daten aus Backups wiederherstellen</li>
                    <li>• Sicherheitslücken schließen</li>
                    <li>• Betroffene informieren</li>
                    <li>• Maßnahmen dokumentieren</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Active Alerts */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Aktive Alerts
                </CardTitle>
                <CardDescription>{unacknowledgedCount} offene Meldung(en)</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={fetchAlerts} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : alerts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-green-500" />
                  <p>Keine Sicherheitsmeldungen</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-3 rounded-lg border ${
                        alert.acknowledged ? 'opacity-50' : ''
                      } ${alert.severity === 'critical' ? 'border-destructive/30 bg-destructive/5' : 'border-amber-500/30 bg-amber-500/5'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className={SEVERITY_STYLES[alert.severity]}>
                              {alert.severity === 'critical' ? 'Kritisch' : 'Warnung'}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{formatDate(alert.created_at)}</span>
                          </div>
                          <p className="text-sm font-medium">{alert.message}</p>
                          {expandedAlert === alert.id && alert.details && (
                            <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-h-32">
                              {JSON.stringify(alert.details, null, 2)}
                            </pre>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setExpandedAlert(expandedAlert === alert.id ? null : alert.id)}
                          >
                            {expandedAlert === alert.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                          {!alert.acknowledged && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => handleAcknowledgeAlert(alert.id)}
                            >
                              <BellOff className="h-3 w-3 mr-1" />
                              Bestätigen
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* BACKUP TEST TAB */}
        <TabsContent value="backups" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Backup-Integritätsprüfung</h3>
              <p className="text-sm text-muted-foreground">Automatische Prüfung ob Transkript-Backups vollständig und lesbar sind</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleCreateMissingBackups} disabled={repairingBackups || runningCheck}>
                {repairingBackups ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Reparatur läuft...</>
                ) : (
                  <><Wrench className="h-4 w-4 mr-2" /> Fehlende Backups erstellen</>
                )}
              </Button>
              <Button onClick={handleRunBackupCheck} disabled={runningCheck || repairingBackups}>
                {runningCheck ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Prüfung läuft...</>
                ) : (
                  <><RefreshCw className="h-4 w-4 mr-2" /> Prüfung starten</>
                )}
              </Button>
            </div>
          </div>

          {repairingBackups && (
            <Card>
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{repairStatus}</span>
                  <span className="font-medium">{repairProgress}%</span>
                </div>
                <Progress value={repairProgress} className="h-2" />
              </CardContent>
            </Card>
          )}

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
          ) : backupChecks.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <HardDrive className="h-10 w-10 mx-auto mb-2" />
                <p>Noch keine Prüfungen durchgeführt</p>
                <p className="text-xs mt-1">Starte eine Prüfung um den Backup-Status zu sehen</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {backupChecks.map((check) => (
                <Card key={check.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {check.status === 'passed' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                        {check.status === 'warning' && <AlertTriangle className="h-5 w-5 text-amber-500" />}
                        {check.status === 'failed' && <XCircle className="h-5 w-5 text-destructive" />}
                        <div>
                          <p className="font-medium text-sm">
                            {check.status === 'passed' ? 'Alle Backups vorhanden' :
                             check.status === 'warning' ? 'Einige Backups fehlen' : 'Backup-Fehler erkannt'}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(check.checked_at)}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className={
                        check.status === 'passed' ? 'bg-green-500/10 text-green-500' :
                        check.status === 'warning' ? 'bg-amber-500/10 text-amber-500' :
                        'bg-destructive/10 text-destructive'
                      }>
                        {check.status === 'passed' ? 'Bestanden' :
                         check.status === 'warning' ? 'Warnung' : 'Fehlgeschlagen'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-4 gap-3 text-center">
                      <div className="p-2 rounded bg-muted/30">
                        <p className="text-lg font-bold">{check.total_recordings}</p>
                        <p className="text-[10px] text-muted-foreground">Gesamt</p>
                      </div>
                      <div className="p-2 rounded bg-green-500/10">
                        <p className="text-lg font-bold text-green-500">{check.backups_found}</p>
                        <p className="text-[10px] text-muted-foreground">Vorhanden</p>
                      </div>
                      <div className="p-2 rounded bg-amber-500/10">
                        <p className="text-lg font-bold text-amber-500">{check.backups_missing}</p>
                        <p className="text-[10px] text-muted-foreground">Fehlend</p>
                      </div>
                      <div className="p-2 rounded bg-destructive/10">
                        <p className="text-lg font-bold text-destructive">{check.backups_corrupted}</p>
                        <p className="text-[10px] text-muted-foreground">Beschädigt</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
