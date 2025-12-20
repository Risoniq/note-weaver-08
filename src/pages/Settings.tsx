import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Bell, Bot, Calendar, Check, Globe, Loader2, Mic, Shield, Upload, Volume2, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Settings = () => {
  const { status, events, connect, disconnect, error } = useGoogleCalendar();
  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting';
  const { toast } = useToast();
  
  // Bot avatar state
  const [botAvatarUrl, setBotAvatarUrl] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Load saved bot avatar URL from localStorage
  useEffect(() => {
    const savedAvatarUrl = localStorage.getItem('bot:avatarUrl');
    if (savedAvatarUrl) {
      setBotAvatarUrl(savedAvatarUrl);
    }
  }, []);
  
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
    
    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Datei zu groß",
        description: "Das Bild darf maximal 2MB groß sein",
        variant: "destructive",
      });
      return;
    }
    
    setIsUploadingAvatar(true);
    
    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `bot-avatar-${Date.now()}.${fileExt}`;
      
      // Upload to Supabase storage
      const { data, error: uploadError } = await supabase.storage
        .from('bot-avatars')
        .upload(fileName, file, { upsert: true });
      
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
                <Input className="w-48" defaultValue="Notetaker Bot" />
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
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Label>Google Kalender</Label>
                    {isConnected && (
                      <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-500/20">
                        <Check className="h-3 w-3 mr-1" />
                        Verbunden
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {isConnected 
                      ? `${events.length} anstehende Meetings synchronisiert` 
                      : 'Synchronisiere Meetings aus Google Kalender'}
                  </p>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                </div>
                {isConnected ? (
                  <Button variant="outline" size="sm" onClick={disconnect}>
                    Trennen
                  </Button>
                ) : (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={connect}
                    disabled={isConnecting}
                  >
                    {isConnecting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Globe className="h-4 w-4 mr-2" />
                    )}
                    {isConnecting ? 'Verbinden...' : 'Verbinden'}
                  </Button>
                )}
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Automatische Aufnahme</Label>
                  <p className="text-sm text-muted-foreground">Bot automatisch zu Kalender-Meetings senden</p>
                </div>
                <Switch />
              </div>
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