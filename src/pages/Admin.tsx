import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, FileText, Clock, Activity, Calendar, CheckCircle, XCircle, Trash2, Shield, Settings, Eye, Plus, UsersRound, Key, ShieldCheck, KeyRound } from 'lucide-react';
import { withTokenRefresh } from '@/lib/retryWithTokenRefresh';
import { SecurityDashboard } from '@/components/admin/SecurityDashboard';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { AdminCreateMeetingDialog } from '@/components/admin/AdminCreateMeetingDialog';
import { TeamCard, type TeamData } from '@/components/admin/TeamCard';
import { TeamDialog } from '@/components/admin/TeamDialog';
import { TeamMembersDialog } from '@/components/admin/TeamMembersDialog';
import { ApiKeyCard, type ApiKeyData } from '@/components/admin/ApiKeyCard';
import { CreateApiKeyDialog } from '@/components/admin/CreateApiKeyDialog';
import { WebhookConfigDialog } from '@/components/admin/WebhookConfigDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UserTeam {
  id: string;
  name: string;
  role: string;
}

interface UserData {
  id: string;
  email: string;
  created_at: string;
  recordings_count: number;
  total_duration: number;
  total_words: number;
  last_activity: string | null;
  google_connected: boolean;
  microsoft_connected: boolean;
  online_status: 'online' | 'recording' | 'offline';
  is_approved: boolean;
  is_admin: boolean;
  max_minutes: number;
  used_minutes: number;
  teams: UserTeam[];
  team_id: string | null;
  team_name: string | null;
  team_role: string | null;
}

interface Summary {
  total_users: number;
  active_users: number;
  total_recordings: number;
  total_minutes: number;
  online_now: number;
  recording_now: number;
}

interface Summary {
  total_users: number;
  active_users: number;
  total_recordings: number;
  total_minutes: number;
  online_now: number;
  recording_now: number;
}

const Admin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { startImpersonating } = useImpersonation();
  const [users, setUsers] = useState<UserData[]>([]);
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKeyData[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('users');
  
  // Quota Edit Dialog
  const [quotaDialogOpen, setQuotaDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [quotaHours, setQuotaHours] = useState<number>(2);
  
  // Create Meeting Dialog
  const [createMeetingOpen, setCreateMeetingOpen] = useState(false);

  // Team Dialogs
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<TeamData | null>(null);
  const [teamMembersDialogOpen, setTeamMembersDialogOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<TeamData | null>(null);

  // API Key Dialogs
  const [createApiKeyDialogOpen, setCreateApiKeyDialogOpen] = useState(false);
  const [webhookDialogOpen, setWebhookDialogOpen] = useState(false);
  const [selectedApiKey, setSelectedApiKey] = useState<ApiKeyData | null>(null);

  const handleViewAsUser = (user: UserData) => {
    startImpersonating(user.id, user.email);
    navigate('/');
  };

  const fetchData = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        navigate('/auth');
        return;
      }

      const response = await withTokenRefresh(
        () => supabase.functions.invoke('admin-dashboard', {
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
        })
      );

      if (response.error) {
        throw new Error(response.error.message || 'Failed to fetch admin data');
      }

      setUsers(response.data.users || []);
      setTeams(response.data.teams || []);
      setSummary(response.data.summary || null);
    } catch (err: any) {
      console.error('Admin dashboard error:', err);
      toast({
        title: 'Fehler',
        description: err.message || 'Daten konnten nicht geladen werden',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [navigate, toast]);

  const handleApprove = async (userId: string, action: 'approve' | 'revoke') => {
    setActionLoading(userId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;

      const response = await withTokenRefresh(
        () => supabase.functions.invoke('admin-approve-user', {
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
          body: { user_id: userId, action },
        })
      );

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast({
        title: action === 'approve' ? 'Benutzer freigeschaltet' : 'Freischaltung aufgehoben',
        description: action === 'approve' 
          ? 'Der Benutzer kann jetzt den Notetaker nutzen.' 
          : 'Der Benutzer kann den Notetaker nicht mehr nutzen.',
      });

      await fetchData();
    } catch (err: any) {
      toast({
        title: 'Fehler',
        description: err.message || 'Aktion fehlgeschlagen',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (userId: string) => {
    setActionLoading(userId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;

      const response = await withTokenRefresh(
        () => supabase.functions.invoke('admin-delete-user', {
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
          body: { user_id: userId },
        })
      );

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast({
        title: 'Benutzer gelöscht',
        description: 'Der Benutzer und alle zugehörigen Daten wurden gelöscht.',
      });

      await fetchData();
    } catch (err: any) {
      toast({
        title: 'Fehler',
        description: err.message || 'Löschen fehlgeschlagen',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendPasswordReset = async (userId: string, email: string) => {
    setActionLoading(userId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;

      const response = await withTokenRefresh(
        () => supabase.functions.invoke('admin-send-password-reset', {
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
          body: { user_id: userId },
        })
      );

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast({
        title: 'Passwort-Reset gesendet',
        description: `Eine E-Mail zur Passwort-Neueinrichtung wurde an ${email} gesendet.`,
      });
    } catch (err: any) {
      toast({
        title: 'Fehler',
        description: err.message || 'Passwort-Reset fehlgeschlagen',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const openQuotaEdit = (user: UserData) => {
    setEditingUser(user);
    setQuotaHours(user.max_minutes / 60);
    setQuotaDialogOpen(true);
  };

  const handleSaveQuota = async () => {
    if (!editingUser) return;
    
    setActionLoading(editingUser.id);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;

      const response = await withTokenRefresh(
        () => supabase.functions.invoke('admin-set-quota', {
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
          body: { 
            user_id: editingUser.id, 
            max_minutes: Math.round(quotaHours * 60) 
          },
        })
      );

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast({
        title: 'Kontingent gespeichert',
        description: `Neues Limit: ${quotaHours}h für ${editingUser.email}`,
      });

      setQuotaDialogOpen(false);
      await fetchData();
    } catch (err: any) {
      toast({
        title: 'Fehler',
        description: err.message || 'Kontingent konnte nicht gespeichert werden',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Team Handlers
  const handleCreateTeam = async (data: { name: string; max_minutes: number }) => {
    setActionLoading('create-team');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;

      const response = await withTokenRefresh(
        () => supabase.functions.invoke('admin-create-team', {
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
          body: data,
        })
      );

      if (response.error) throw new Error(response.error.message);

      toast({
        title: 'Team erstellt',
        description: `${data.name} wurde erfolgreich erstellt.`,
      });

      setTeamDialogOpen(false);
      await fetchData();
    } catch (err: any) {
      toast({
        title: 'Fehler',
        description: err.message || 'Team konnte nicht erstellt werden',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateTeam = async (data: { name: string; max_minutes: number }) => {
    if (!editingTeam) return;
    setActionLoading(editingTeam.id);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;

      const response = await withTokenRefresh(
        () => supabase.functions.invoke('admin-update-team', {
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
          body: { team_id: editingTeam.id, ...data },
        })
      );

      if (response.error) throw new Error(response.error.message);

      toast({
        title: 'Team aktualisiert',
        description: `${data.name} wurde erfolgreich aktualisiert.`,
      });

      setTeamDialogOpen(false);
      setEditingTeam(null);
      await fetchData();
    } catch (err: any) {
      toast({
        title: 'Fehler',
        description: err.message || 'Team konnte nicht aktualisiert werden',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    setActionLoading(teamId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;

      const response = await withTokenRefresh(
        () => supabase.functions.invoke('admin-delete-team', {
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
          body: { team_id: teamId },
        })
      );

      if (response.error) throw new Error(response.error.message);

      toast({
        title: 'Team gelöscht',
        description: 'Das Team wurde erfolgreich gelöscht.',
      });

      await fetchData();
    } catch (err: any) {
      toast({
        title: 'Fehler',
        description: err.message || 'Team konnte nicht gelöscht werden',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleAssignTeamMember = async (userId: string, teamId: string, role: string = 'member') => {
    setActionLoading(userId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;

      const response = await withTokenRefresh(
        () => supabase.functions.invoke('admin-assign-team-member', {
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
          body: { user_id: userId, team_id: teamId, action: 'assign', role },
        })
      );

      if (response.error) throw new Error(response.error.message);

      toast({
        title: 'Mitglied zugeordnet',
        description: 'Der Benutzer wurde dem Team zugeordnet.',
      });

      await fetchData();
    } catch (err: any) {
      toast({
        title: 'Fehler',
        description: err.message || 'Zuordnung fehlgeschlagen',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveTeamMember = async (userId: string, teamId: string) => {
    setActionLoading(userId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;

      const response = await withTokenRefresh(
        () => supabase.functions.invoke('admin-assign-team-member', {
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
          body: { user_id: userId, team_id: teamId, action: 'remove' },
        })
      );

      if (response.error) throw new Error(response.error.message);

      toast({
        title: 'Mitglied entfernt',
        description: 'Der Benutzer wurde aus dem Team entfernt.',
      });

      await fetchData();
    } catch (err: any) {
      toast({
        title: 'Fehler',
        description: err.message || 'Entfernen fehlgeschlagen',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleSetTeamRole = async (userId: string, role: string, teamId: string) => {
    setActionLoading(userId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;

      const response = await withTokenRefresh(
        () => supabase.functions.invoke('admin-assign-team-member', {
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
          body: { user_id: userId, action: 'set-role', role, team_id: teamId },
        })
      );

      if (response.error) throw new Error(response.error.message);

      toast({
        title: 'Rolle aktualisiert',
        description: role === 'lead' ? 'Benutzer ist jetzt Teamlead.' : 'Benutzer ist jetzt Mitglied.',
      });

      await fetchData();
    } catch (err: any) {
      toast({
        title: 'Fehler',
        description: err.message || 'Rolle konnte nicht geändert werden',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const openEditTeam = (team: TeamData) => {
    setEditingTeam(team);
    setTeamDialogOpen(true);
  };

  const openManageMembers = (team: TeamData) => {
    setSelectedTeam(team);
    setTeamMembersDialogOpen(true);
  };

  // API Key Handlers
  const fetchApiKeys = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;

      const response = await withTokenRefresh(
        () => supabase.functions.invoke('admin-list-api-keys', {
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
        })
      );

      if (response.error) throw new Error(response.error.message);
      setApiKeys(response.data.api_keys || []);
    } catch (err: any) {
      console.error('Error fetching API keys:', err);
    }
  };

  const handleCreateApiKey = async (data: { name: string; permissions: any; expires_at: string | null }) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return null;

      const response = await withTokenRefresh(
        () => supabase.functions.invoke('admin-create-api-key', {
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
          body: data,
        })
      );

      if (response.error) throw new Error(response.error.message);

      toast({
        title: 'API-Key erstellt',
        description: 'Kopiere den Key jetzt – er wird nur einmal angezeigt!',
      });

      await fetchApiKeys();
      return { api_key: response.data.api_key };
    } catch (err: any) {
      toast({
        title: 'Fehler',
        description: err.message || 'API-Key konnte nicht erstellt werden',
        variant: 'destructive',
      });
      return null;
    }
  };

  const handleDeleteApiKey = async (keyId: string) => {
    setActionLoading(keyId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;

      const response = await withTokenRefresh(
        () => supabase.functions.invoke('admin-delete-api-key', {
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
          body: { key_id: keyId },
        })
      );

      if (response.error) throw new Error(response.error.message);

      toast({
        title: 'API-Key gelöscht',
        description: 'Der API-Key wurde erfolgreich gelöscht.',
      });

      await fetchApiKeys();
    } catch (err: any) {
      toast({
        title: 'Fehler',
        description: err.message || 'Löschen fehlgeschlagen',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleWebhookAction = async (action: string, data: any): Promise<boolean> => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return false;

      const response = await withTokenRefresh(
        () => supabase.functions.invoke('admin-save-webhook-config', {
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
          body: { action, ...data },
        })
      );

      if (response.error) throw new Error(response.error.message);

      if (action === 'test') {
        if (response.data.success) {
          toast({ title: 'Test erfolgreich', description: 'Webhook wurde gesendet.' });
        } else {
          toast({ title: 'Test fehlgeschlagen', description: response.data.error, variant: 'destructive' });
        }
        return response.data.success;
      }

      toast({
        title: action === 'delete' ? 'Webhook gelöscht' : 'Webhook gespeichert',
      });

      await fetchApiKeys();
      return true;
    } catch (err: any) {
      toast({
        title: 'Fehler',
        description: err.message || 'Aktion fehlgeschlagen',
        variant: 'destructive',
      });
      return false;
    }
  };

  const openWebhookConfig = (apiKey: ApiKeyData) => {
    setSelectedApiKey(apiKey);
    setWebhookDialogOpen(true);
  };

  // Fetch API keys when tab changes to api-keys
  useEffect(() => {
    if (activeTab === 'api-keys') {
      fetchApiKeys();
    }
  }, [activeTab]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '–';
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return '–';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatNumber = (num: number) => {
    if (!num) return '0';
    return num.toLocaleString('de-DE');
  };

  const getQuotaPercentage = (user: UserData) => {
    if (user.max_minutes === 0) return 0;
    return Math.min(100, (user.used_minutes / user.max_minutes) * 100);
  };

  const getQuotaColor = (user: UserData) => {
    const percentage = getQuotaPercentage(user);
    if (percentage >= 100) return 'bg-destructive';
    if (percentage >= 80) return 'bg-amber-500';
    return 'bg-primary';
  };

  const getStatusBadge = (user: UserData) => {
    if (user.is_admin) {
      return <Badge className="bg-purple-500 hover:bg-purple-600"><Shield className="h-3 w-3 mr-1" />Admin</Badge>;
    }
    if (user.is_approved) {
      return <Badge className="bg-green-500 hover:bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Freigeschaltet</Badge>;
    }
    return <Badge variant="secondary" className="bg-amber-100 text-amber-800"><Clock className="h-3 w-3 mr-1" />Wartet</Badge>;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Admin Dashboard</h1>
              <p className="text-muted-foreground">Benutzerübersicht und Statistiken</p>
            </div>
          </div>
          <Button onClick={() => setCreateMeetingOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Meeting anlegen
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Gesamt Benutzer
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className="text-2xl font-bold">{summary?.total_users || 0}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Aktive Benutzer (7 Tage)
              </CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className="text-2xl font-bold">{summary?.active_users || 0}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Gesamt Aufnahmen
              </CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className="text-2xl font-bold">{summary?.total_recordings || 0}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Verbrauchte Stunden
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className="text-2xl font-bold">
                  {Math.floor((summary?.total_minutes || 0) / 60)}h {(summary?.total_minutes || 0) % 60}min
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tabs for Users, Teams, and API-Keys */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="users" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Benutzer
              </TabsTrigger>
              <TabsTrigger value="teams" className="flex items-center gap-2">
                <UsersRound className="h-4 w-4" />
                Teams
              </TabsTrigger>
              <TabsTrigger value="api-keys" className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                API-Keys
              </TabsTrigger>
              <TabsTrigger value="security" className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Sicherheit
              </TabsTrigger>
            </TabsList>
            {activeTab === 'teams' && (
              <Button onClick={() => { setEditingTeam(null); setTeamDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Team erstellen
              </Button>
            )}
            {activeTab === 'api-keys' && (
              <Button onClick={() => setCreateApiKeyDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                API-Key erstellen
              </Button>
            )}
          </div>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>Alle Benutzer</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Benutzer</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Team</TableHead>
                          <TableHead>Kontingent</TableHead>
                          <TableHead>Registriert</TableHead>
                          <TableHead className="text-right">Aufnahmen</TableHead>
                          <TableHead>Kalender</TableHead>
                          <TableHead>Aktionen</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {user.email}
                                {user.online_status === 'online' && (
                                  <span 
                                    className="inline-block w-2 h-2 rounded-full bg-green-500" 
                                    title="Online"
                                  />
                                )}
                                {user.online_status === 'recording' && (
                                  <span 
                                    className="inline-block w-2 h-2 rounded-full bg-orange-500" 
                                    title="Bot aktiv"
                                  />
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{getStatusBadge(user)}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {(user.teams || []).length === 0 ? (
                                  <span className="text-muted-foreground text-sm">Kein Team</span>
                                ) : (
                                  (user.teams || []).map((ut) => (
                                    <Badge
                                      key={ut.id}
                                      variant={ut.role === 'lead' ? 'default' : 'secondary'}
                                      className="text-xs"
                                    >
                                      {ut.role === 'lead' && '👑 '}
                                      {ut.name}
                                    </Badge>
                                  ))
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2 min-w-[160px]">
                                <Progress 
                                  value={getQuotaPercentage(user)} 
                                  className="w-16 h-2"
                                  indicatorClassName={getQuotaColor(user)}
                                />
                                <span className="text-sm text-muted-foreground whitespace-nowrap">
                                  {Math.round(user.used_minutes / 60 * 10) / 10}h / {Math.round(user.max_minutes / 60)}h
                                  {user.team_name && <span className="text-xs ml-1">(Team)</span>}
                                </span>
                                {!user.team_id && (
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6"
                                    onClick={() => openQuotaEdit(user)}
                                  >
                                    <Settings className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{formatDate(user.created_at)}</TableCell>
                            <TableCell className="text-right">{user.recordings_count}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {user.google_connected && (
                                  <Badge variant="secondary" className="text-xs">
                                    <Calendar className="h-3 w-3 mr-1" />
                                    Google
                                  </Badge>
                                )}
                                {user.microsoft_connected && (
                                  <Badge variant="secondary" className="text-xs">
                                    <Calendar className="h-3 w-3 mr-1" />
                                    Microsoft
                                  </Badge>
                                )}
                                {!user.google_connected && !user.microsoft_connected && (
                                  <span className="text-muted-foreground text-sm">–</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                {/* View as user button - available for all users */}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleViewAsUser(user)}
                                  title="Als Benutzer anzeigen"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                
                                {!user.is_admin && (
                                  <>
                                    {user.is_approved ? (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleApprove(user.id, 'revoke')}
                                        disabled={actionLoading === user.id}
                                      >
                                        <XCircle className="h-4 w-4 mr-1" />
                                        Sperren
                                      </Button>
                                    ) : (
                                      <Button
                                        variant="default"
                                        size="sm"
                                        onClick={() => handleApprove(user.id, 'approve')}
                                        disabled={actionLoading === user.id}
                                      >
                                        <CheckCircle className="h-4 w-4 mr-1" />
                                        Freischalten
                                      </Button>
                                    )}
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button
                                          variant="destructive"
                                          size="sm"
                                          disabled={actionLoading === user.id}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Benutzer löschen?</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Möchtest du den Benutzer <strong>{user.email}</strong> wirklich löschen? 
                                            Alle Aufnahmen, Transkripte und Daten werden unwiderruflich gelöscht.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() => handleDelete(user.id)}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                          >
                                            Endgültig löschen
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {users.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                              Keine Benutzer gefunden
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Teams Tab */}
          <TabsContent value="teams">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-40 w-full" />
                ))}
              </div>
            ) : teams.length === 0 ? (
              <Card className="p-8 text-center">
                <UsersRound className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Noch keine Teams</h3>
                <p className="text-muted-foreground mb-4">
                  Erstelle ein Team, um Benutzern ein gemeinsames Meeting-Kontingent zuzuweisen.
                </p>
                <Button onClick={() => { setEditingTeam(null); setTeamDialogOpen(true); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Erstes Team erstellen
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {teams.map((team) => (
                  <TeamCard
                    key={team.id}
                    team={team}
                    onEdit={openEditTeam}
                    onDelete={handleDeleteTeam}
                    onManageMembers={openManageMembers}
                    isLoading={actionLoading === team.id}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* API-Keys Tab */}
          <TabsContent value="api-keys">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-48 w-full" />
                ))}
              </div>
            ) : apiKeys.length === 0 ? (
              <Card className="p-8 text-center">
                <Key className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Noch keine API-Keys</h3>
                <p className="text-muted-foreground mb-4">
                  Erstelle einen API-Key, um Dashboard-Daten extern abzurufen oder automatische Reports zu konfigurieren.
                </p>
                <Button onClick={() => setCreateApiKeyDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Ersten API-Key erstellen
                </Button>
              </Card>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {apiKeys.map((apiKey) => (
                    <ApiKeyCard
                      key={apiKey.id}
                      apiKey={apiKey}
                      onDelete={handleDeleteApiKey}
                      onConfigureWebhook={openWebhookConfig}
                      isDeleting={actionLoading === apiKey.id}
                    />
                  ))}
                </div>

                {/* API Documentation */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">API-Dokumentation</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-muted/50 rounded-md p-4 font-mono text-sm">
                      <p className="text-muted-foreground mb-2">Base-URL:</p>
                      <code>https://kltxpsrghuxzfbctkdnz.supabase.co/functions/v1</code>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <h4 className="font-semibold">Dashboard-Daten</h4>
                        <code className="text-xs bg-muted px-2 py-1 rounded">GET /api-dashboard</code>
                        <p className="text-xs text-muted-foreground">
                          Parameter: include_users, include_teams, include_summary
                        </p>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-semibold">Transkripte</h4>
                        <code className="text-xs bg-muted px-2 py-1 rounded">GET /api-transcripts</code>
                        <p className="text-xs text-muted-foreground">
                          Parameter: since, user_id, team_id, limit, include_analysis
                        </p>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-semibold">Team-Statistiken</h4>
                        <code className="text-xs bg-muted px-2 py-1 rounded">GET /api-team-stats</code>
                        <p className="text-xs text-muted-foreground">
                          Parameter: team_id
                        </p>
                      </div>
                    </div>

                    <div className="bg-muted/50 rounded-md p-4">
                      <p className="text-sm font-medium mb-2">Beispiel-Aufruf:</p>
                      <pre className="text-xs overflow-x-auto">
{`curl -X GET \\
  -H "x-api-key: ntr_DEIN_API_KEY" \\
  "https://kltxpsrghuxzfbctkdnz.supabase.co/functions/v1/api-dashboard?include_summary=true"`}
                      </pre>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security">
            <SecurityDashboard />
          </TabsContent>
        </Tabs>

        {/* Quota Edit Dialog */}
        <Dialog open={quotaDialogOpen} onOpenChange={setQuotaDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Kontingent bearbeiten</DialogTitle>
              <DialogDescription>
                {editingUser?.email}
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="quota-hours">Maximale Meeting-Stunden</Label>
                <Input 
                  id="quota-hours"
                  type="number" 
                  value={quotaHours} 
                  onChange={(e) => setQuotaHours(Number(e.target.value))}
                  min={0}
                  step={0.5}
                />
              </div>
              
              {editingUser && (
                <div className="text-sm text-muted-foreground">
                  <p>Aktuell verbraucht: {Math.round(editingUser.used_minutes / 60 * 10) / 10}h</p>
                  <p>Verbleibend nach Änderung: {Math.max(0, quotaHours - editingUser.used_minutes / 60).toFixed(1)}h</p>
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setQuotaDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button 
                onClick={handleSaveQuota}
                disabled={actionLoading === editingUser?.id}
              >
                Speichern
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Team Create/Edit Dialog */}
        <TeamDialog
          open={teamDialogOpen}
          onOpenChange={(open) => {
            setTeamDialogOpen(open);
            if (!open) setEditingTeam(null);
          }}
          team={editingTeam}
          onSave={editingTeam ? handleUpdateTeam : handleCreateTeam}
          isLoading={actionLoading === 'create-team' || actionLoading === editingTeam?.id}
        />

        {/* Team Members Dialog */}
        <TeamMembersDialog
          open={teamMembersDialogOpen}
          onOpenChange={(open) => {
            setTeamMembersDialogOpen(open);
            if (!open) setSelectedTeam(null);
          }}
          team={selectedTeam}
          users={users}
          onAssign={handleAssignTeamMember}
          onRemove={handleRemoveTeamMember}
          onSetRole={handleSetTeamRole}
          isLoading={!!actionLoading}
        />

        {/* Create Meeting Dialog */}
        <AdminCreateMeetingDialog
          open={createMeetingOpen}
          onOpenChange={setCreateMeetingOpen}
          users={users.map(u => ({ id: u.id, email: u.email }))}
          onSuccess={fetchData}
        />

        {/* Create API Key Dialog */}
        <CreateApiKeyDialog
          open={createApiKeyDialogOpen}
          onOpenChange={setCreateApiKeyDialogOpen}
          onCreateKey={handleCreateApiKey}
          isCreating={actionLoading === 'create-api-key'}
        />

        {/* Webhook Config Dialog */}
        <WebhookConfigDialog
          open={webhookDialogOpen}
          onOpenChange={(open) => {
            setWebhookDialogOpen(open);
            if (!open) setSelectedApiKey(null);
          }}
          apiKey={selectedApiKey}
          onSave={handleWebhookAction}
          isSaving={!!actionLoading}
        />
      </div>
    </div>
  );
};

export default Admin;
