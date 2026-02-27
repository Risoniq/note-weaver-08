import { useState, useRef, useEffect, useCallback } from "react";
import { ArrowLeft, Bell, Bot, Calendar as CalendarIcon, Check, Download, FileText, HelpCircle, Image as ImageIcon, Loader2, LogOut, Mic, PlayCircle, RefreshCw, Settings2, Shield, Upload, Volume2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useOnboardingTour } from "@/hooks/useOnboardingTour";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useRecallCalendarMeetings } from "@/hooks/useRecallCalendarMeetings";
import { useGoogleRecallCalendar } from "@/hooks/useGoogleRecallCalendar";
import { useMicrosoftRecallCalendar } from "@/hooks/useMicrosoftRecallCalendar";
import { RecallCalendarConnection } from "@/components/calendar/RecallCalendarConnection";
import { AppLayout } from "@/components/layout/AppLayout";
import { useUserBranding } from "@/hooks/useUserBranding";

const Settings = () => {
  const { toast } = useToast();
  const { resetTour } = useOnboardingTour();
  const navigate = useNavigate();
  const { isImpersonating, impersonatedUserId, impersonatedUserEmail } = useImpersonation();
  const { isAdmin } = useAdminCheck();
  const { branding, updateBranding } = useUserBranding();
  
  // Branding state
  const [brandingAppName, setBrandingAppName] = useState("");
  const [brandingLogoUrl, setBrandingLogoUrl] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isSavingBranding, setIsSavingBranding] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  
  // Calendar hooks
  const { preferences, updatePreferences, fetchMeetings, preferencesLoaded } = useRecallCalendarMeetings();
  const google = useGoogleRecallCalendar();
  const microsoft = useMicrosoftRecallCalendar();
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };
  
  // Bot settings state
  const [botName, setBotName] = useState("Notetaker Bot");
  const [botAvatarUrl, setBotAvatarUrl] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isSyncingBotName, setIsSyncingBotName] = useState(false);
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
  
  // Load saved bot settings from database (with localStorage fallback)
  const loadBotSettings = useCallback(async () => {
    try {
      // If admin is impersonating, use edge function to fetch target user's bot settings
      if (isAdmin && isImpersonating && impersonatedUserId) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data, error } = await supabase.functions.invoke('admin-view-user-data', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: { 
            target_user_id: impersonatedUserId, 
            data_type: 'bot_settings' 
          },
        });

        if (error) {
          console.error('Error fetching impersonated bot settings:', error);
        } else if (data?.bot_settings) {
          if (data.bot_settings.bot_name) {
            setBotName(data.bot_settings.bot_name);
          }
          if (data.bot_settings.bot_avatar_url) {
            setBotAvatarUrl(data.bot_settings.bot_avatar_url);
          }
        }
        return;
      }

      // Normal flow for current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      // Try to load from database first
      const { data, error } = await supabase
        .from('recall_calendar_users')
        .select('bot_name, bot_avatar_url')
        .eq('supabase_user_id', user.id)
        .maybeSingle();
      
      if (data) {
        if (data.bot_name) {
          setBotName(data.bot_name);
          localStorage.setItem('bot:name', data.bot_name);
        }
        if (data.bot_avatar_url) {
          setBotAvatarUrl(data.bot_avatar_url);
          localStorage.setItem('bot:avatarUrl', data.bot_avatar_url);
        }
      } else {
        // Fallback to localStorage for backwards compatibility
        const savedAvatarUrl = localStorage.getItem('bot:avatarUrl');
        if (savedAvatarUrl) setBotAvatarUrl(savedAvatarUrl);
        const savedBotName = localStorage.getItem('bot:name');
        if (savedBotName) setBotName(savedBotName);
      }
    } catch (err) {
      console.error('Error loading bot settings:', err);
      // Fallback to localStorage
      const savedAvatarUrl = localStorage.getItem('bot:avatarUrl');
      if (savedAvatarUrl) setBotAvatarUrl(savedAvatarUrl);
      const savedBotName = localStorage.getItem('bot:name');
      if (savedBotName) setBotName(savedBotName);
    }
  }, [isAdmin, isImpersonating, impersonatedUserId]);

  const loadTranscriptBackups = useCallback(async () => {
    setIsLoadingBackups(true);
    try {
      // If admin is impersonating, use edge function to fetch target user's backups
      if (isAdmin && isImpersonating && impersonatedUserId) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setIsLoadingBackups(false);
          return;
        }

        const { data, error } = await supabase.functions.invoke('admin-view-user-data', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: { 
            target_user_id: impersonatedUserId, 
            data_type: 'transcript_backups' 
          },
        });

        if (error) {
          console.error('Error fetching impersonated backups:', error);
        } else {
          setTranscriptBackups(data?.transcript_backups || []);
        }
        setIsLoadingBackups(false);
        return;
      }

      // Normal flow for current user
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
  }, [isAdmin, isImpersonating, impersonatedUserId]);

  useEffect(() => {
    loadBotSettings();
    loadTranscriptBackups();
  }, [loadBotSettings, loadTranscriptBackups]);

  // Sync branding state when hook data loads
  useEffect(() => {
    if (branding) {
      setBrandingAppName(branding.app_name || "");
      setBrandingLogoUrl(branding.logo_url || null);
    }
  }, [branding]);

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    setIsUploadingLogo(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const filePath = `${user.id}/logo-${Date.now()}.${file.name.split('.').pop()}`;
      const { error: uploadError } = await supabase.storage
        .from('user-logos')
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('user-logos').getPublicUrl(filePath);
      setBrandingLogoUrl(publicUrl);
      await updateBranding(publicUrl, brandingAppName || null);
      toast({ title: "Logo hochgeladen" });
    } catch (err) {
      console.error('Logo upload error:', err);
      toast({ title: "Upload fehlgeschlagen", variant: "destructive" });
    } finally {
      setIsUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const removeLogo = async () => {
    setBrandingLogoUrl(null);
    try {
      await updateBranding(null, brandingAppName || null);
      toast({ title: "Logo entfernt" });
    } catch (err) {
      console.error('Error removing logo:', err);
    }
  };

  const saveBrandingSettings = async () => {
    setIsSavingBranding(true);
    try {
      await updateBranding(brandingLogoUrl, brandingAppName || null);
      toast({ title: "Branding gespeichert" });
    } catch (err) {
      console.error('Error saving branding:', err);
      toast({ title: "Fehler beim Speichern", variant: "destructive" });
    } finally {
      setIsSavingBranding(false);
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
  };
  
  // Save bot name to database and localStorage, then sync to Recall.ai
  const saveBotName = async () => {
    setIsSyncingBotName(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      localStorage.setItem('bot:name', botName);
      
      // Save to database
      const { error } = await supabase
        .from('recall_calendar_users')
        .update({ bot_name: botName })
        .eq('supabase_user_id', user.id);
      
      if (error) {
        console.error('Error saving bot name:', error);
        toast({
          title: "Fehler beim Speichern",
          description: "Der Bot-Name konnte nicht gespeichert werden.",
          variant: "destructive",
        });
        return;
      }
      
      // Sync bot settings to Recall.ai for automated calendar bots
      try {
        const { data: syncResult, error: syncError } = await supabase.functions.invoke('recall-calendar-meetings', {
          body: { action: 'sync_bot_settings' }
        });
        
        console.log('Sync result:', syncResult);
        
        if (syncError || !syncResult?.success) {
          toast({
            title: "Gespeichert (Sync ausstehend)",
            description: "Bot-Name wurde lokal gespeichert. Sync zu Recall.ai wird bei nächster Verbindung durchgeführt.",
          });
        } else {
          toast({
            title: "Gespeichert & synchronisiert",
            description: `Bot-Name "${botName}" wurde zu Recall.ai synchronisiert.`,
          });
        }
      } catch (syncErr) {
        console.warn('Could not sync bot settings to Recall.ai:', syncErr);
        toast({
          title: "Gespeichert",
          description: "Bot-Name wurde lokal gespeichert.",
        });
      }
    } catch (err) {
      console.error('Error saving bot name:', err);
      toast({
        title: "Fehler beim Speichern",
        variant: "destructive",
      });
    } finally {
      setIsSyncingBotName(false);
    }
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
          // White background for transparent PNGs
          if (ctx) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Komprimierung fehlgeschlagen'));
                return;
              }
              
              if (blob.size <= maxSizeBytes || quality <= 0.1) {
                URL.revokeObjectURL(img.src);
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
      
      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        reject(new Error('Bild konnte nicht geladen werden'));
      };
      img.src = URL.createObjectURL(file);
    });
  };
  
  // Convert any image to JPEG format (Recall.ai only accepts JPEG)
  const convertToJpeg = (file: File, quality: number = 0.92): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        
        // White background (important for PNGs with transparency)
        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
        }
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              URL.revokeObjectURL(img.src);
              resolve(blob);
            } else {
              reject(new Error('JPEG-Konvertierung fehlgeschlagen'));
            }
          },
          'image/jpeg',
          quality
        );
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        reject(new Error('Bild konnte nicht geladen werden'));
      };
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
      let uploadFile: Blob;
      
      // ALWAYS convert to JPEG (Recall.ai only accepts JPEG for bot avatars)
      if (file.size > maxSize) {
        toast({
          title: "Bild wird komprimiert...",
          description: "Das Bild wird auf unter 2MB verkleinert",
        });
        uploadFile = await compressImage(file, maxSize);
      } else {
        // Convert smaller images to JPEG as well
        uploadFile = await convertToJpeg(file);
      }
      
      // Get user for folder path
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Nicht angemeldet",
          description: "Bitte melde dich an, um ein Profilbild hochzuladen.",
          variant: "destructive",
        });
        return;
      }
      
      // Always use .jpg extension (Recall.ai requires JPEG)
      const filePath = `${user.id}/bot-avatar-${Date.now()}.jpg`;
      
      // Upload to Supabase storage
      const { data, error: uploadError } = await supabase.storage
        .from('bot-avatars')
        .upload(filePath, uploadFile, { upsert: true });
      
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('bot-avatars')
        .getPublicUrl(filePath);
      
      setBotAvatarUrl(publicUrl);
      localStorage.setItem('bot:avatarUrl', publicUrl);
      
      // Save to database and sync to Recall.ai (user already fetched above)
      await supabase
        .from('recall_calendar_users')
        .update({ bot_avatar_url: publicUrl })
        .eq('supabase_user_id', user.id);
      
      // Sync bot settings to Recall.ai for automated calendar bots
      try {
        await supabase.functions.invoke('recall-calendar-meetings', {
          body: { action: 'sync_bot_settings' }
        });
      } catch (syncErr) {
        console.warn('Could not sync bot settings to Recall.ai:', syncErr);
      }
      
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
  
  const removeAvatar = async () => {
    setBotAvatarUrl(null);
    localStorage.removeItem('bot:avatarUrl');
    
    // Remove from database and sync to Recall.ai
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('recall_calendar_users')
          .update({ bot_avatar_url: null })
          .eq('supabase_user_id', user.id);
        
        // Sync bot settings to Recall.ai for automated calendar bots
        try {
          await supabase.functions.invoke('recall-calendar-meetings', {
            body: { action: 'sync_bot_settings' }
          });
        } catch (syncErr) {
          console.warn('Could not sync bot settings to Recall.ai:', syncErr);
        }
      }
    } catch (err) {
      console.error('Error removing avatar from DB:', err);
    }
    
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
    <AppLayout>
    <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
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
                  <p className="text-xs text-amber-600 dark:text-amber-400">⚠️ Avatar funktioniert nur bei manueller Bot-Zuschaltung</p>
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
                      accept="image/jpeg,image/png,image/gif,image/webp,.jpg,.jpeg,.png,.gif,.webp"
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
                    onClick={saveBotName}
                    disabled={isSyncingBotName}
                  >
                    {isSyncingBotName ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Check className="h-4 w-4 mr-1" />
                    )}
                    {isSyncingBotName ? "Sync..." : "Speichern"}
                  </Button>
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Automatisch beitreten</Label>
                  <p className="text-sm text-muted-foreground">Bot tritt automatisch bei Meeting-Start bei</p>
                </div>
                <Switch />
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

          {/* Calendar Connections */}
          <Card data-tour="calendar-connection">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-primary" />
                <CardTitle>Kalender-Verbindungen</CardTitle>
              </div>
              <CardDescription>Verbinde Google oder Microsoft Kalender, damit der Bot automatisch deinen Meetings beitritt</CardDescription>
            </CardHeader>
            <CardContent>
              <RecallCalendarConnection
                googleStatus={google.status}
                googleError={google.error}
                googleConnected={google.connected}
                googlePendingOauthUrl={google.pendingOauthUrl}
                googleIsLoading={google.isLoading}
                onConnectGoogle={google.connect}
                onDisconnectGoogle={google.disconnect}
                onCheckGoogleStatus={google.checkStatus}
                microsoftStatus={microsoft.status}
                microsoftError={microsoft.error}
                microsoftConnected={microsoft.connected}
                microsoftPendingOauthUrl={microsoft.pendingOauthUrl}
                microsoftIsLoading={microsoft.isLoading}
                onConnectMicrosoft={microsoft.connect}
                onDisconnectMicrosoft={microsoft.disconnect}
                onCheckMicrosoftStatus={microsoft.checkStatus}
                onRefreshMeetings={fetchMeetings}
              />
            </CardContent>
          </Card>

          {/* Recording Preferences */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-primary" />
                <CardTitle>Aufnahme-Einstellungen</CardTitle>
              </div>
              <CardDescription>Konfiguriere, welche Meetings automatisch aufgezeichnet werden sollen</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!preferencesLoaded ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between" data-tour="auto-record">
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
                </>
              )}
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

          {/* Help & Tutorials */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-primary" />
                <CardTitle>Hilfe & Anleitungen</CardTitle>
              </div>
              <CardDescription>Lerne die App kennen und erhalte Unterstützung</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Kalender-Tour</Label>
                  <p className="text-sm text-muted-foreground">Lerne, wie du deinen Kalender verbindest und automatische Aufnahmen aktivierst</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={resetTour}
                  className="gap-2"
                >
                  <PlayCircle className="h-4 w-4" />
                  Tour starten
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Logout */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <LogOut className="h-5 w-5 text-destructive" />
                <CardTitle>Abmelden</CardTitle>
              </div>
              <CardDescription>Melde dich von deinem Konto ab</CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                variant="destructive" 
                onClick={handleLogout}
                className="gap-2"
              >
                <LogOut className="h-4 w-4" />
                Abmelden
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default Settings;