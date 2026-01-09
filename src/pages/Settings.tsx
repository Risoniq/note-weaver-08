import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Bell, Bot, Calendar, Check, Download, FileText, Globe, Loader2, Mic, RefreshCw, Shield, Upload, Volume2, X, Settings2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRecallCalendarMeetings } from "@/hooks/useRecallCalendarMeetings";
import { useGoogleRecallCalendar } from "@/hooks/useGoogleRecallCalendar";
import { useMicrosoftRecallCalendar } from "@/hooks/useMicrosoftRecallCalendar";
import { RecallCalendarConnection } from "@/components/calendar/RecallCalendarConnection";

const Settings = () => {
  const { status, events, connect, disconnect, error } = useGoogleCalendar();
  const { preferences, updatePreferences, fetchMeetings } = useRecallCalendarMeetings();
  const google = useGoogleRecallCalendar();
  const microsoft = useMicrosoftRecallCalendar();
  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting';
  const { toast } = useToast();
  
  // Bot settings state
  const [botName, setBotName] = useState("Notetaker Bot");
  const [botAvatarUrl, setBotAvatarUrl] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isRepairingRecordings, setIsRepairingRecordings] = useState(false);
  
  // Transcript backups state
  interface TranscriptBackup {
    name: string;
    created_at: string;
    size: number;
  }
  const [transcriptBackups, setTranscriptBackups] = useState<TranscriptBackup[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Load saved bot settings from localStorage
  useEffect(() => {
    const savedAvatarUrl = localStorage.getItem('bot:avatarUrl');
    if (savedAvatarUrl) {
      setBotAvatarUrl(savedAvatarUrl);
    }
    const savedBotName = localStorage.getItem('bot:name');
    if (savedBotName) {
      setBotName(savedBotName);
    }
    // Load transcript backups on mount
    loadTranscriptBackups();
  }, []);
  
  const loadTranscriptBackups = async () => {
    setIsLoadingBackups(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data, error } = await supabase.storage
        .from('transcript-backups')
        .list(user.id, {
          sortBy: { column: 'created_at', order: 'desc' }
        });
      
      if (error) throw error;
      
      setTranscriptBackups((data || []).map(file => ({
        name: file.name,
        created_at: file.created_at || '',
        size: file.metadata?.size || 0
      })));
    } catch (err) {
      console.error('Error loading backups:', err);
    } finally {
      setIsLoadingBackups(false);
    }
  };
  
  const downloadBackup = async (fileName: string) => {
    setIsDownloading(fileName);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data, error } = await supabase.storage
        .from('transcript-backups')
        .download(`${user.id}/${fileName}`);
      
      if (error) {
        toast({ title: "Download fehlgeschlagen", variant: "destructive" });
        return;
      }
      
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      
      toast({ title: "Transkript heruntergeladen" });
    } catch (err) {
      console.error('Download error:', err);
      toast({ title: "Download fehlgeschlagen", variant: "destructive" });
    } finally {
      setIsDownloading(null);
    }
  };
  
  const formatBackupDate = (dateString: string) => {
    if (!dateString) return 'Unbekannt';
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  const handleBotNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setBotName(newName);
    localStorage.setItem('bot:name', newName);
  };
  
  // Compress image to target size
  const compressImage = (file: File, maxSizeBytes: number): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      img.onload = () => {
        let { width, height } = img;
        let quality = 0.9;
        
        // Start with original dimensions
        canvas.width = width;
        canvas.height = height;
        
        const tryCompress = () => {
          ctx?.clearRect(0, 0, canvas.width, canvas.height);
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Komprimierung fehlgeschlagen'));
                return;
              }
              
              if (blob.size <= maxSizeBytes || quality <= 0.1) {
                resolve(blob);
              } else {
                // Reduce quality or dimensions
                quality -= 0.1;
                if (quality <= 0.3) {
                  // Also reduce dimensions
                  canvas.width = Math.floor(canvas.width * 0.8);
                  canvas.height = Math.floor(canvas.height * 0.8);
                }
                tryCompress();
              }
            },
            'image/jpeg',
            quality
          );
        };
        
        tryCompress();
      };
      
      img.onerror = () => reject(new Error('Bild konnte nicht geladen werden'));
      img.src = URL.createObjectURL(file);
    });
  };
  
  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Ungültiger Dateityp",
        description: "Bitte lade ein Bild hoch (JPG, PNG, etc.)",
        variant: "destructive",
      });
      return;
    }
    
    setIsUploadingAvatar(true);
    
    try {
      const maxSize = 2 * 1024 * 1024; // 2MB
      let uploadFile: File | Blob = file;
      
      // Compress if file is too large
      if (file.size > maxSize) {
        toast({
          title: "Bild wird komprimiert...",
          description: "Das Bild wird auf unter 2MB verkleinert",
        });
        uploadFile = await compressImage(file, maxSize);
      }
      
      // Generate unique filename (always use jpg for compressed images)
      const fileExt = file.size > maxSize ? 'jpg' : file.name.split('.').pop();
      const fileName = `bot-avatar-${Date.now()}.${fileExt}`;
      
      // Upload to Supabase storage
      const { data, error: uploadError } = await supabase.storage
        .from('bot-avatars')
        .upload(fileName, uploadFile, { upsert: true });
      
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('bot-avatars')
        .getPublicUrl(fileName);
      
      setBotAvatarUrl(publicUrl);
      localStorage.setItem('bot:avatarUrl', publicUrl);
      
      toast({
        title: "Profilbild hochgeladen",
        description: "Das Bot-Profilbild wurde erfolgreich gespeichert",
      });
    } catch (err) {
      console.error('Avatar upload error:', err);
      toast({
        title: "Upload fehlgeschlagen",
        description: "Das Bild konnte nicht hochgeladen werden",
        variant: "destructive",
      });
    } finally {
      setIsUploadingAvatar(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  const removeAvatar = () => {
    setBotAvatarUrl(null);
    localStorage.removeItem('bot:avatarUrl');
    toast({
      title: "Profilbild entfernt",
      description: "Das Bot-Profilbild wurde entfernt",
    });
  };
  
  const repairAllRecordings = async () => {
    setIsRepairingRecordings(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Nicht angemeldet",
          description: "Bitte melde dich an, um Aufzeichnungen zu reparieren.",
          variant: "destructive",
        });
        return;
      }
      
      const response = await supabase.functions.invoke('repair-all-recordings');
      
      if (response.error) {
        throw new Error(response.error.message);
      }
      
      const result = response.data;
      toast({
        title: "Reparatur abgeschlossen",
        description: `${result.repaired} von ${result.repaired + result.failed} Aufzeichnungen wurden aktualisiert.`,
      });
    } catch (err) {
      console.error('Repair error:', err);
      toast({
        title: "Reparatur fehlgeschlagen",
        description: "Die Aufzeichnungen konnten nicht repariert werden.",
        variant: "destructive",
      });
    } finally {
      setIsRepairingRecordings(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link to="/">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Einstellungen</h1>
            <p className="text-muted-foreground">Konfiguriere deinen AI Meeting Recorder</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Bot Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                <CardTitle>Bot Einstellungen</CardTitle>
              </div>
              <CardDescription>Passe das Verhalten des Meeting-Bots an</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Bot Profile Image */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Bot-Profilbild</Label>
                  <p className="text-sm text-muted-foreground">Wird in MS Teams & Google Meet angezeigt</p>
                </div>
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12 border-2 border-border">
                    <AvatarImage src={botAvatarUrl || undefined} alt="Bot Avatar" />
                    <AvatarFallback className="bg-primary/10">
                      <Bot className="h-6 w-6 text-primary" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleAvatarUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingAvatar}
                    >
                      {isUploadingAvatar ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                    </Button>
                    {botAvatarUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={removeAvatar}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Bot-Name</Label>
                  <p className="text-sm text-muted-foreground">Der Name, der im Meeting angezeigt wird</p>
                </div>
                <div className="flex items-center gap-2">
                  <Input 
                    className="w-48" 
                    value={botName} 
                    onChange={(e) => setBotName(e.target.value)}
                    placeholder="Notetaker Bot"
                  />
                  <Button 
                    size="sm" 
                    onClick={() => {
                      localStorage.setItem('bot:name', botName);
                      toast({
                        title: "Gespeichert",
                        description: "Bot-Name wurde gespeichert.",
                      });
                    }}
                  >
                    Speichern
                  </Button>
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Automatisch beitreten</Label>
                  <p className="text-sm text-muted-foreground">Bot tritt automatisch bei Meeting-Start bei</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Warteraum überspringen</Label>
                  <p className="text-sm text-muted-foreground">Versuche den Warteraum zu umgehen</p>
                </div>
                <Switch />
              </div>
            </CardContent>
          </Card>

          {/* Transcription Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Mic className="h-5 w-5 text-primary" />
                <CardTitle>Transkription</CardTitle>
              </div>
              <CardDescription>Einstellungen für die Spracherkennung</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Sprache</Label>
                  <p className="text-sm text-muted-foreground">Primäre Sprache für die Transkription</p>
                </div>
                <Select defaultValue="auto">
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Automatisch erkennen</SelectItem>
                    <SelectItem value="de">Deutsch</SelectItem>
                    <SelectItem value="en">Englisch</SelectItem>
                    <SelectItem value="fr">Französisch</SelectItem>
                    <SelectItem value="es">Spanisch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Sprecher-Erkennung</Label>
                  <p className="text-sm text-muted-foreground">Identifiziere verschiedene Sprecher im Transkript</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Genauigkeitsmodus</Label>
                  <p className="text-sm text-muted-foreground">Priorisiere Genauigkeit über Geschwindigkeit</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Alle Transkripte reparieren</Label>
                  <p className="text-sm text-muted-foreground">Aktualisiert Teilnehmernamen in allen bestehenden Aufzeichnungen</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={repairAllRecordings}
                  disabled={isRepairingRecordings}
                >
                  {isRepairingRecordings ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Repariere...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Reparieren
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Audio Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Volume2 className="h-5 w-5 text-primary" />
                <CardTitle>Audio & Video</CardTitle>
              </div>
              <CardDescription>Aufnahme-Einstellungen</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Video aufnehmen</Label>
                  <p className="text-sm text-muted-foreground">Meeting-Video zusätzlich zum Audio speichern</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Videoqualität</Label>
                  <p className="text-sm text-muted-foreground">Qualität der Videoaufnahme</p>
                </div>
                <Select defaultValue="720p">
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="480p">480p</SelectItem>
                    <SelectItem value="720p">720p (HD)</SelectItem>
                    <SelectItem value="1080p">1080p (Full HD)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                <CardTitle>Benachrichtigungen</CardTitle>
              </div>
              <CardDescription>Wann möchtest du benachrichtigt werden?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Aufnahme abgeschlossen</Label>
                  <p className="text-sm text-muted-foreground">Benachrichtigung wenn die Aufnahme fertig ist</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Analyse bereit</Label>
                  <p className="text-sm text-muted-foreground">Benachrichtigung wenn die KI-Analyse fertig ist</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Fehler-Benachrichtigungen</Label>
                  <p className="text-sm text-muted-foreground">Bei Problemen mit der Aufnahme informieren</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>

          {/* Calendar Integration */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <CardTitle>Kalender-Integration</CardTitle>
              </div>
              <CardDescription>Verbinde deinen Kalender für automatische Aufnahmen</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Calendar Connection Cards */}
              <RecallCalendarConnection
                // Google props
                googleStatus={google.status}
                googleError={google.error}
                googleConnected={google.connected}
                googlePendingOauthUrl={google.pendingOauthUrl}
                googleIsLoading={google.isLoading}
                onConnectGoogle={google.connect}
                onDisconnectGoogle={google.disconnect}
                onCheckGoogleStatus={google.checkStatus}
                // Microsoft props
                microsoftStatus={microsoft.status}
                microsoftError={microsoft.error}
                microsoftConnected={microsoft.connected}
                microsoftPendingOauthUrl={microsoft.pendingOauthUrl}
                microsoftIsLoading={microsoft.isLoading}
                onConnectMicrosoft={microsoft.connect}
                onDisconnectMicrosoft={microsoft.disconnect}
                onCheckMicrosoftStatus={microsoft.checkStatus}
                // Shared
                onRefreshMeetings={fetchMeetings}
              />
              
              <Separator />
              
              {/* Recording Preferences from Recall.ai */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-2 mb-2">
                  <Settings2 size={16} className="text-muted-foreground" />
                  <Label className="text-sm font-medium">Aufnahme-Einstellungen</Label>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Automatische Aufnahme</Label>
                    <p className="text-sm text-muted-foreground">Bot tritt automatisch allen Meetings bei</p>
                  </div>
                  <Switch
                    checked={preferences.auto_record}
                    onCheckedChange={(checked) => updatePreferences({ auto_record: checked })}
                  />
                </div>
                <Separator />
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Alle Meetings aufnehmen</Label>
                    <p className="text-sm text-muted-foreground">Auch Meetings, zu denen du eingeladen wurdest</p>
                  </div>
                  <Switch
                    checked={preferences.record_all}
                    onCheckedChange={(checked) => updatePreferences({ record_all: checked })}
                  />
                </div>
                <Separator />
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Nur eigene Meetings</Label>
                    <p className="text-sm text-muted-foreground">Nur Meetings aufnehmen, die du organisiert hast</p>
                  </div>
                  <Switch
                    checked={preferences.record_only_owned}
                    onCheckedChange={(checked) => updatePreferences({ record_only_owned: checked })}
                  />
                </div>
                <Separator />
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Externe Meetings aufnehmen</Label>
                    <p className="text-sm text-muted-foreground">Meetings mit externen Teilnehmern aufnehmen</p>
                  </div>
                  <Switch
                    checked={preferences.record_external}
                    onCheckedChange={(checked) => updatePreferences({ record_external: checked })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Transcript Backups */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <CardTitle>Transkript-Backups</CardTitle>
              </div>
              <CardDescription>Alle Transkripte werden automatisch gesichert</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingBackups ? (
                <div className="flex items-center gap-2 py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Lade Backups...</span>
                </div>
              ) : transcriptBackups.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">Keine Backups vorhanden</p>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      {transcriptBackups.length} Backup(s) gefunden
                    </span>
                    <Button variant="outline" size="sm" onClick={loadTranscriptBackups}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Aktualisieren
                    </Button>
                  </div>
                  <ScrollArea className="h-64 rounded-md border">
                    <div className="p-2">
                      {transcriptBackups.map((backup) => (
                        <div key={backup.name} className="flex justify-between items-center py-3 px-2 border-b last:border-b-0 hover:bg-muted/50 rounded">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">{formatBackupDate(backup.created_at)}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {backup.name} • {backup.size > 0 ? `${(backup.size / 1024).toFixed(1)} KB` : 'Größe unbekannt'}
                            </p>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => downloadBackup(backup.name)}
                            disabled={isDownloading === backup.name}
                          >
                            {isDownloading === backup.name ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Privacy Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <CardTitle>Datenschutz</CardTitle>
              </div>
              <CardDescription>Deine Daten und Privatsphäre</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Aufnahmen automatisch löschen</Label>
                  <p className="text-sm text-muted-foreground">Aufnahmen nach einer bestimmten Zeit löschen</p>
                </div>
                <Select defaultValue="never">
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">Nie</SelectItem>
                    <SelectItem value="30">Nach 30 Tagen</SelectItem>
                    <SelectItem value="90">Nach 90 Tagen</SelectItem>
                    <SelectItem value="365">Nach 1 Jahr</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Transkripte verschlüsseln</Label>
                  <p className="text-sm text-muted-foreground">Ende-zu-Ende Verschlüsselung für Transkripte</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Settings;