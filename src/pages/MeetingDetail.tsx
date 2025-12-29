import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Recording, getStatusLabel, getStatusColor } from "@/types/recording";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  FileText, 
  Target, 
  CheckSquare, 
  Video,
  Mail,
  BarChart3,
  MessageSquare,
  Users,
  Copy,
  Check,
  Sparkles,
  Play,
  RefreshCw,
  Edit3,
  Save,
  X,
  Replace
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";

type TimeFilter = 'heute' | '7tage' | '30tage' | '90tage' | 'alle';

export default function MeetingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [recording, setRecording] = useState<Recording | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [activeFilter, setActiveFilter] = useState<TimeFilter>('7tage');
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Transkript-Bearbeitung States
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);
  const [editedTranscript, setEditedTranscript] = useState('');
  const [isSavingTranscript, setIsSavingTranscript] = useState(false);
  const [showReplaceDialog, setShowReplaceDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');

  const fetchRecording = useCallback(async () => {
    if (!id) return null;
    
    try {
      const { data, error } = await supabase
        .from('recordings')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data as unknown as Recording | null;
    } catch (error) {
      console.error('Error fetching recording:', error);
      return null;
    }
  }, [id]);

  const syncRecordingStatus = useCallback(async (forceResync = false) => {
    if (!id || !recording) {
      return;
    }
    
    // Wenn nicht forced, nur bei nicht-fertigen Status synchronisieren
    if (!forceResync && (recording.status === 'done' || recording.status === 'error')) {
      return;
    }

    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-recording', {
        body: { id, force_resync: forceResync }
      });

      if (error) {
        console.error('Sync error:', error);
        toast.error("Synchronisierung fehlgeschlagen");
        return;
      }

      // Refetch the recording to get updated data
      const updatedRecording = await fetchRecording();
      if (updatedRecording) {
        setRecording(updatedRecording);
        
        if (forceResync) {
          toast.success("Transkript und Teilnehmernamen wurden aktualisiert!");
        } else if (updatedRecording.status === 'done' && recording.status !== 'done') {
          toast.success("Aufnahme erfolgreich verarbeitet!");
        }
      }
    } catch (error) {
      console.error('Error syncing recording:', error);
      toast.error("Synchronisierung fehlgeschlagen");
    } finally {
      setIsSyncing(false);
    }
  }, [id, recording, fetchRecording]);

  // Initial fetch
  useEffect(() => {
    const loadRecording = async () => {
      const data = await fetchRecording();
      if (!data) {
        toast.error("Meeting nicht gefunden");
        navigate('/');
        return;
      }
      setRecording(data);
      setIsLoading(false);
    };

    loadRecording();
  }, [fetchRecording, navigate]);

  // Auto-sync for pending recordings every 30 seconds
  useEffect(() => {
    if (!recording) return;

    const isPending = ['pending', 'joining', 'recording', 'processing'].includes(recording.status);

    if (isPending) {
      // Sync immediately on first load if pending
      syncRecordingStatus();

      // Set up interval for subsequent syncs
      syncIntervalRef.current = setInterval(() => {
        syncRecordingStatus();
      }, 30000); // 30 seconds
    }

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    };
  }, [recording?.status, syncRecordingStatus]);

  const sanitizeContent = (text: string): string => {
    // Remove asterisks and markdown formatting
    let cleaned = text.replace(/\*+/g, '');
    // Remove potential passwords (patterns like password:, pw:, passwort:)
    cleaned = cleaned.replace(/(?:password|passwort|pw|kennwort)\s*[:=]\s*\S+/gi, '[ENTFERNT]');
    // Remove profanity and insults (common German words)
    const profanityPatterns = [
      /\b(schei[ßs]e?|verdammt|arsch|idiot|dumm|blöd|depp|trottel|vollidiot|wichser|hurensohn|fick|f[uü]ck)\b/gi
    ];
    profanityPatterns.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '[...]');
    });
    return cleaned;
  };

  const generateFollowUpEmail = (recording: Recording): string => {
    const title = sanitizeContent(recording.title || `Meeting ${recording.meeting_id.slice(0, 8)}`);
    const date = format(new Date(recording.created_at), "dd. MMMM yyyy", { locale: de });
    
    let email = `Betreff: Follow-Up: ${title}\n\n`;
    email += `Liebe Kolleginnen und Kollegen,\n\n`;
    email += `vielen Dank für die Teilnahme am Meeting "${title}" am ${date}.\n\n`;
    
    if (recording.summary) {
      email += `Zusammenfassung:\n${sanitizeContent(recording.summary)}\n\n`;
    }
    
    if (recording.key_points && recording.key_points.length > 0) {
      email += `Wichtige Punkte:\n`;
      recording.key_points.forEach((point, index) => {
        email += `${index + 1}. ${sanitizeContent(point)}\n`;
      });
      email += `\n`;
    }
    
    if (recording.action_items && recording.action_items.length > 0) {
      email += `Nächste Schritte:\n`;
      recording.action_items.forEach((item) => {
        email += `• ${sanitizeContent(item)}\n`;
      });
      email += `\n`;
    }
    
    email += `Bei Rückfragen stehe ich gerne zur Verfügung.\n\n`;
    email += `Mit freundlichen Grüßen`;
    
    return email;
  };

  const copyEmailToClipboard = () => {
    if (!recording) return;
    const email = generateFollowUpEmail(recording);
    navigator.clipboard.writeText(email);
    setCopiedEmail(true);
    toast.success("E-Mail in Zwischenablage kopiert");
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  // Transkript bearbeiten Funktionen
  const startEditingTranscript = () => {
    if (recording?.transcript_text) {
      setEditedTranscript(recording.transcript_text);
      setIsEditingTranscript(true);
    }
  };

  const cancelEditingTranscript = () => {
    setIsEditingTranscript(false);
    setEditedTranscript('');
    setShowReplaceDialog(false);
    setSearchTerm('');
    setReplaceTerm('');
  };

  const saveTranscript = async () => {
    if (!id || !editedTranscript) return;
    
    setIsSavingTranscript(true);
    try {
      // Transkript in der Datenbank aktualisieren
      const { error: updateError } = await supabase
        .from('recordings')
        .update({ transcript_text: editedTranscript })
        .eq('id', id);

      if (updateError) throw updateError;

      // Lokal aktualisieren
      setRecording(prev => prev ? { ...prev, transcript_text: editedTranscript } : null);
      setIsEditingTranscript(false);
      toast.success("Transkript gespeichert!");
      
      // Frage ob Analyse neu durchgeführt werden soll
      toast.info("Analyse wird mit neuem Transkript aktualisiert...");
      
      // Analyse neu starten
      const { error: analyzeError } = await supabase.functions.invoke('analyze-transcript', {
        body: { recording_id: id }
      });

      if (analyzeError) {
        console.error('Analyze error:', analyzeError);
        toast.error("Analyse konnte nicht gestartet werden");
      } else {
        // Nach kurzer Verzögerung neu laden
        setTimeout(async () => {
          const updated = await fetchRecording();
          if (updated) {
            setRecording(updated);
            toast.success("Analyse erfolgreich aktualisiert!");
          }
        }, 3000);
      }
    } catch (error) {
      console.error('Error saving transcript:', error);
      toast.error("Speichern fehlgeschlagen");
    } finally {
      setIsSavingTranscript(false);
    }
  };

  const replaceAllInTranscript = () => {
    if (!searchTerm) return;
    
    const newTranscript = editedTranscript.split(searchTerm).join(replaceTerm);
    const replacements = (editedTranscript.match(new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    
    setEditedTranscript(newTranscript);
    setShowReplaceDialog(false);
    setSearchTerm('');
    setReplaceTerm('');
    
    toast.success(`${replacements} Ersetzung${replacements !== 1 ? 'en' : ''} durchgeführt`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen gradient-hero">
        <div className="container mx-auto px-6 py-8 max-w-7xl">
          <Skeleton className="h-12 w-64 mb-8 rounded-2xl" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-3xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!recording) {
    return (
      <div className="min-h-screen gradient-hero flex items-center justify-center">
        <p className="text-muted-foreground">Meeting nicht gefunden</p>
      </div>
    );
  }

  const formattedDate = format(new Date(recording.created_at), "dd. MMMM yyyy, HH:mm 'Uhr'", { locale: de });
  const duration = recording.duration ? Math.floor(recording.duration / 60) : 0;
  const wordCount = recording.word_count || 0;
  const keyPointsCount = recording.key_points?.length || 0;
  const actionItemsCount = recording.action_items?.length || 0;

  // Teilnehmer aus Transkript oder participants-Feld extrahieren
  const extractParticipants = (transcript: string | null): string[] => {
    if (!transcript) return [];
    const speakerPattern = /^([^:]+):/gm;
    const matches = transcript.match(speakerPattern);
    if (!matches) return [];
    const speakers = matches.map(m => m.replace(':', '').trim());
    // Alle unique Sprecher zurückgeben (auch "Unbekannt" und "Sprecher X")
    return [...new Set(speakers)];
  };
  
  // Nutze participants aus DB wenn vorhanden, sonst extrahiere aus Transkript
  const dbParticipants = recording.participants as { id: string; name: string }[] | null;
  const transcriptParticipants = extractParticipants(recording.transcript_text);
  
  // Berechne Teilnehmeranzahl
  let participantCount = 0;
  let participantNames: string[] = [];
  
  if (dbParticipants && dbParticipants.length > 0) {
    // Aus DB (zukünftige Meetings mit Speaker Timeline)
    participantCount = dbParticipants.length;
    participantNames = dbParticipants.map(p => p.name);
  } else if (transcriptParticipants.length > 0) {
    // Aus Transkript extrahiert
    // Wenn alle "Unbekannt" sind, zähle die verschiedenen Sprechblöcke um Sprecher zu schätzen
    const nonUnknown = transcriptParticipants.filter(s => s !== 'Unbekannt');
    if (nonUnknown.length > 0) {
      participantCount = nonUnknown.length;
      participantNames = nonUnknown;
    } else {
      // Bei "Unbekannt" versuchen wir die Anzahl der Sprecher anhand von Gesprächsmustern zu schätzen
      // Mindestens 2 Teilnehmer wenn es ein Gespräch gibt
      participantCount = recording.transcript_text && recording.transcript_text.includes('\n\n') ? 2 : 1;
      participantNames = ['Unbekannte Teilnehmer'];
    }
  } else if (recording.transcript_text) {
    participantCount = 1;
    participantNames = ['Unbekannt'];
  }

  const filterButtons: { key: TimeFilter; label: string }[] = [
    { key: 'heute', label: 'Heute' },
    { key: '7tage', label: '7 Tage' },
    { key: '30tage', label: '30 Tage' },
    { key: '90tage', label: '90 Tage' },
    { key: 'alle', label: 'Alle' },
  ];

  return (
    <div className="min-h-screen gradient-hero">
      <div className="container mx-auto px-6 py-8 max-w-7xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8 animate-fade-in">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate('/')}
            className="shrink-0 rounded-xl hover:bg-white/50 transition-all"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-bold text-foreground">
              {recording.title || `Meeting ${recording.meeting_id.slice(0, 8)}`}
            </h1>
            <p className="text-muted-foreground mt-1">
              {format(new Date(recording.created_at), "EEEE, dd. MMMM yyyy 'um' HH:mm 'Uhr'", { locale: de })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Re-Sync Button für abgeschlossene Meetings */}
            {recording.status === 'done' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncRecordingStatus(true)}
                disabled={isSyncing}
                className="rounded-xl hover:bg-primary/10 transition-all"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Aktualisiere...' : 'Transkript neu laden'}
              </Button>
            )}
            {/* Status-Sync für laufende Meetings */}
            {['pending', 'joining', 'recording', 'processing'].includes(recording.status) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => syncRecordingStatus(false)}
                disabled={isSyncing}
                className="rounded-xl hover:bg-white/50 transition-all"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Synchronisiere...' : 'Aktualisieren'}
              </Button>
            )}
            <Badge className={`shrink-0 px-4 py-1.5 text-sm rounded-full ${getStatusColor(recording.status)}`}>
              {getStatusLabel(recording.status)}
              {isSyncing && <RefreshCw className="h-3 w-3 ml-1.5 animate-spin inline" />}
            </Badge>
          </div>
        </div>

        {/* KPI Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Teilnehmer Card - Network Graph Visualization */}
          <Card className="glass-card border-0 rounded-3xl shadow-card overflow-hidden animate-fade-in hover:shadow-lg transition-all hover:-translate-y-1" style={{ animationDelay: '50ms' }}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 rounded-2xl bg-primary/10">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Teilnehmer</p>
                  <p className="text-3xl font-bold text-primary">{participantCount}</p>
                </div>
              </div>

              {/* Network Graph Visualization */}
              <div className="h-24 relative flex items-center justify-center">
                <svg className="w-full h-full" viewBox="0 0 120 80">
                  {/* Connection lines */}
                  <line x1="60" y1="40" x2="25" y2="20" stroke="hsl(var(--primary))" strokeWidth="1" strokeOpacity="0.3" />
                  <line x1="60" y1="40" x2="95" y2="20" stroke="hsl(var(--primary))" strokeWidth="1" strokeOpacity="0.3" />
                  <line x1="60" y1="40" x2="20" y2="55" stroke="hsl(var(--primary))" strokeWidth="1" strokeOpacity="0.3" />
                  <line x1="60" y1="40" x2="100" y2="55" stroke="hsl(var(--primary))" strokeWidth="1" strokeOpacity="0.3" />
                  <line x1="25" y1="20" x2="95" y2="20" stroke="hsl(var(--primary))" strokeWidth="1" strokeOpacity="0.15" strokeDasharray="2,2" />
                  <line x1="20" y1="55" x2="100" y2="55" stroke="hsl(var(--primary))" strokeWidth="1" strokeOpacity="0.15" strokeDasharray="2,2" />
                  
                  {/* Central node (meeting) */}
                  <circle cx="60" cy="40" r="12" fill="hsl(var(--primary))" fillOpacity="0.2" stroke="hsl(var(--primary))" strokeWidth="2" />
                  <circle cx="60" cy="40" r="6" fill="hsl(var(--primary))" />
                  
                  {/* Participant nodes */}
                  {participantCount >= 1 && <circle cx="25" cy="20" r="8" fill="hsl(var(--primary))" fillOpacity="0.6" className="animate-pulse" style={{ animationDelay: '0ms' }} />}
                  {participantCount >= 2 && <circle cx="95" cy="20" r="8" fill="hsl(var(--primary))" fillOpacity="0.6" className="animate-pulse" style={{ animationDelay: '200ms' }} />}
                  {participantCount >= 3 && <circle cx="20" cy="55" r="8" fill="hsl(var(--primary))" fillOpacity="0.6" className="animate-pulse" style={{ animationDelay: '400ms' }} />}
                  {participantCount >= 4 && <circle cx="100" cy="55" r="8" fill="hsl(var(--primary))" fillOpacity="0.6" className="animate-pulse" style={{ animationDelay: '600ms' }} />}
                </svg>
              </div>
            </CardContent>
          </Card>

          {/* Key Points Card - Radar/Sunburst Visualization */}
          <Card className="glass-card border-0 rounded-3xl shadow-card overflow-hidden animate-fade-in hover:shadow-lg transition-all hover:-translate-y-1" style={{ animationDelay: '100ms' }}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 rounded-2xl bg-accent/10">
                  <Target className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Key Points</p>
                  <p className="text-3xl font-bold text-accent">{keyPointsCount}</p>
                </div>
              </div>

              {/* Radial/Target Visualization */}
              <div className="h-24 relative flex items-center justify-center">
                <svg className="w-full h-full" viewBox="0 0 120 80">
                  {/* Concentric circles (target rings) */}
                  <circle cx="60" cy="40" r="35" fill="none" stroke="hsl(var(--accent))" strokeWidth="1" strokeOpacity="0.1" />
                  <circle cx="60" cy="40" r="25" fill="none" stroke="hsl(var(--accent))" strokeWidth="1" strokeOpacity="0.2" />
                  <circle cx="60" cy="40" r="15" fill="none" stroke="hsl(var(--accent))" strokeWidth="1" strokeOpacity="0.3" />
                  <circle cx="60" cy="40" r="5" fill="hsl(var(--accent))" fillOpacity="0.5" />
                  
                  {/* Key point indicators as radial dots */}
                  {Array.from({ length: Math.min(keyPointsCount, 8) }).map((_, i) => {
                    const angle = (i * 360 / Math.min(keyPointsCount, 8)) * (Math.PI / 180) - Math.PI / 2;
                    const radius = 20 + (i % 3) * 8;
                    const x = 60 + Math.cos(angle) * radius;
                    const y = 40 + Math.sin(angle) * radius;
                    return (
                      <g key={i}>
                        <line 
                          x1="60" y1="40" x2={x} y2={y} 
                          stroke="hsl(var(--accent))" strokeWidth="1" strokeOpacity="0.3" 
                        />
                        <circle 
                          cx={x} cy={y} r="4" 
                          fill="hsl(var(--accent))" 
                          className="animate-pulse"
                          style={{ animationDelay: `${i * 100}ms` }}
                        />
                      </g>
                    );
                  })}
                </svg>
              </div>
            </CardContent>
          </Card>

          {/* To-Dos Card - Checklist Progress Visualization */}
          <Card className="glass-card border-0 rounded-3xl shadow-card overflow-hidden animate-fade-in hover:shadow-lg transition-all hover:-translate-y-1" style={{ animationDelay: '150ms' }}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 rounded-2xl bg-success/10">
                  <CheckSquare className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">To-Dos</p>
                  <p className="text-3xl font-bold text-success">{actionItemsCount}</p>
                </div>
              </div>

              {/* Task List Visualization */}
              <div className="h-24 flex flex-col justify-center gap-2">
                {Array.from({ length: Math.min(actionItemsCount, 4) }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2 animate-fade-in" style={{ animationDelay: `${i * 100}ms` }}>
                    <div className="w-4 h-4 rounded border-2 border-success/60 flex items-center justify-center bg-success/10">
                      <div className="w-2 h-2 rounded-sm bg-success/60" />
                    </div>
                    <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-success/60 to-success rounded-full transition-all"
                        style={{ width: `${70 + Math.random() * 30}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono">#{i + 1}</span>
                  </div>
                ))}
                {actionItemsCount > 4 && (
                  <p className="text-xs text-muted-foreground text-center">+{actionItemsCount - 4} weitere</p>
                )}
                {actionItemsCount === 0 && (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-sm text-muted-foreground">Keine To-Dos</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Summary */}
            {recording.summary && (
              <Card className="glass-card border-0 rounded-3xl shadow-card animate-fade-in" style={{ animationDelay: '250ms' }}>
                <CardHeader className="pb-3 pt-6 px-6">
                  <CardTitle className="flex items-center gap-3 text-lg">
                    <div className="p-2 rounded-xl bg-primary/10">
                      <MessageSquare className="h-5 w-5 text-primary" />
                    </div>
                    Zusammenfassung
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-6 pb-6">
                  <p className="text-foreground leading-relaxed">{recording.summary}</p>
                </CardContent>
              </Card>
            )}

            {/* Key Points */}
            {recording.key_points && recording.key_points.length > 0 && (
              <Card className="glass-card border-0 rounded-3xl shadow-card animate-fade-in" style={{ animationDelay: '300ms' }}>
                <CardHeader className="pb-3 pt-6 px-6">
                  <CardTitle className="flex items-center gap-3 text-lg">
                    <div className="p-2 rounded-xl bg-accent/10">
                      <Target className="h-5 w-5 text-accent" />
                    </div>
                    Key Points
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-6 pb-6">
                  <ul className="space-y-3">
                    {recording.key_points.map((point, index) => (
                      <li key={index} className="flex items-start gap-3 p-3 rounded-2xl bg-secondary/30 hover:bg-secondary/50 transition-colors">
                        <span className="flex items-center justify-center h-7 w-7 rounded-full bg-accent text-accent-foreground text-sm font-bold shrink-0">
                          {index + 1}
                        </span>
                        <span className="text-foreground pt-0.5">{point}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Action Items */}
            {recording.action_items && recording.action_items.length > 0 && (
              <Card className="glass-card border-0 rounded-3xl shadow-card animate-fade-in" style={{ animationDelay: '350ms' }}>
                <CardHeader className="pb-3 pt-6 px-6">
                  <CardTitle className="flex items-center gap-3 text-lg">
                    <div className="p-2 rounded-xl bg-success/10">
                      <CheckSquare className="h-5 w-5 text-success" />
                    </div>
                    To-Dos
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-6 pb-6">
                  <ul className="space-y-3">
                    {recording.action_items.map((item, index) => (
                      <li key={index} className="flex items-start gap-3 p-3 rounded-2xl bg-secondary/30 hover:bg-secondary/50 transition-colors group cursor-pointer">
                        <div className="h-6 w-6 rounded-lg border-2 border-success/50 shrink-0 mt-0.5 group-hover:bg-success/20 transition-colors flex items-center justify-center">
                          <Check className="h-4 w-4 text-success opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <span className="text-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Transcript */}
            {recording.transcript_text && (
              <Card className="glass-card border-0 rounded-3xl shadow-card animate-fade-in" style={{ animationDelay: '400ms' }}>
                <CardHeader className="pb-3 pt-6 px-6">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-3 text-lg">
                      <div className="p-2 rounded-xl bg-muted">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                      Transkript
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {isEditingTranscript ? (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowReplaceDialog(!showReplaceDialog)}
                            className="rounded-xl"
                          >
                            <Replace className="h-4 w-4 mr-1" />
                            Ersetzen
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={cancelEditingTranscript}
                            className="rounded-xl"
                          >
                            <X className="h-4 w-4 mr-1" />
                            Abbrechen
                          </Button>
                          <Button
                            size="sm"
                            onClick={saveTranscript}
                            disabled={isSavingTranscript}
                            className="rounded-xl bg-success hover:bg-success/90"
                          >
                            <Save className="h-4 w-4 mr-1" />
                            {isSavingTranscript ? 'Speichern...' : 'Speichern & Analysieren'}
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={startEditingTranscript}
                          className="rounded-xl"
                        >
                          <Edit3 className="h-4 w-4 mr-1" />
                          Namen bearbeiten
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-6 pb-6 space-y-4">
                  {/* Suchen & Ersetzen Dialog */}
                  {showReplaceDialog && (
                    <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 space-y-3">
                      <p className="text-sm font-medium text-foreground">Namen suchen und ersetzen</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Suchen nach</label>
                          <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="z.B. Unbekannt"
                            className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Ersetzen durch</label>
                          <input
                            type="text"
                            value={replaceTerm}
                            onChange={(e) => setReplaceTerm(e.target.value)}
                            placeholder="z.B. Max Mustermann"
                            className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowReplaceDialog(false)}
                          className="rounded-xl"
                        >
                          Abbrechen
                        </Button>
                        <Button
                          size="sm"
                          onClick={replaceAllInTranscript}
                          disabled={!searchTerm}
                          className="rounded-xl"
                        >
                          Alle ersetzen
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {/* Transkript Anzeige/Bearbeitung */}
                  {isEditingTranscript ? (
                    <textarea
                      value={editedTranscript}
                      onChange={(e) => setEditedTranscript(e.target.value)}
                      className="w-full h-80 rounded-2xl bg-secondary/30 p-4 text-foreground text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 border-0"
                      placeholder="Transkript bearbeiten..."
                    />
                  ) : (
                    <div className="max-h-80 overflow-y-auto rounded-2xl bg-secondary/30 p-4">
                      <p className="text-foreground whitespace-pre-wrap text-sm leading-relaxed">
                        {recording.transcript_text}
                      </p>
                    </div>
                  )}
                  
                  {isEditingTranscript && (
                    <p className="text-xs text-muted-foreground">
                      Tipp: Nutze "Ersetzen" um alle Vorkommen eines Namens (z.B. "Sprecher 1") durch den echten Namen zu ersetzen. Nach dem Speichern wird die Analyse automatisch aktualisiert.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Actions */}
          <div className="space-y-6">
            {/* Deep Dive Button */}
            <Card className="glass-card border-0 rounded-3xl shadow-card overflow-hidden animate-fade-in" style={{ animationDelay: '250ms' }}>
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center">
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 mb-4">
                    <Sparkles className="h-10 w-10 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">Deep Dive Analyse</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    KI-gestützte Tiefenanalyse des Meetings
                  </p>
                  <Button 
                    className="w-full rounded-xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-primary transition-all"
                    onClick={() => toast.info("Deep Dive Analyse wird gestartet...")}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Analyse starten
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Follow-Up Email */}
            <Card className="glass-card border-0 rounded-3xl shadow-card animate-fade-in" style={{ animationDelay: '300ms' }}>
              <CardHeader className="pb-3 pt-6 px-6">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="p-2 rounded-xl bg-primary/10">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  Follow-Up E-Mail
                </CardTitle>
              </CardHeader>
              <CardContent className="px-6 pb-6 space-y-4">
                <p className="text-sm text-muted-foreground">
                  Automatisch generierte Follow-Up E-Mail
                </p>
                <div className="max-h-48 overflow-y-auto rounded-2xl bg-secondary/30 p-4">
                  <pre className="text-xs text-foreground whitespace-pre-wrap font-sans">
                    {generateFollowUpEmail(recording)}
                  </pre>
                </div>
                <Button 
                  className="w-full rounded-xl" 
                  variant={copiedEmail ? "secondary" : "outline"}
                  onClick={copyEmailToClipboard}
                >
                  {copiedEmail ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Kopiert!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      E-Mail kopieren
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Video */}
            {recording.video_url && (
              <Card className="glass-card border-0 rounded-3xl shadow-card animate-fade-in" style={{ animationDelay: '350ms' }}>
                <CardHeader className="pb-3 pt-6 px-6">
                  <CardTitle className="flex items-center gap-3 text-lg">
                    <div className="p-2 rounded-xl bg-primary/10">
                      <Video className="h-5 w-5 text-primary" />
                    </div>
                    Video
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-6 pb-6">
                  <div className="aspect-video rounded-2xl overflow-hidden bg-secondary/30 relative group">
                    <video 
                      src={recording.video_url} 
                      controls 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Stats */}
            <Card className="glass-card border-0 rounded-3xl shadow-card animate-fade-in" style={{ animationDelay: '400ms' }}>
              <CardHeader className="pb-3 pt-6 px-6">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="p-2 rounded-xl bg-accent/10">
                    <BarChart3 className="h-5 w-5 text-accent" />
                  </div>
                  Statistiken
                </CardTitle>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 rounded-2xl bg-secondary/30">
                    <span className="text-sm text-muted-foreground">Dauer</span>
                    <span className="font-semibold text-foreground">{duration} Min</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-2xl bg-secondary/30">
                    <span className="text-sm text-muted-foreground">Wortanzahl</span>
                    <span className="font-semibold text-foreground">{wordCount.toLocaleString('de-DE')}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-2xl bg-secondary/30">
                    <span className="text-sm text-muted-foreground">Wörter/Min</span>
                    <span className="font-semibold text-foreground">
                      {duration > 0 ? Math.round(wordCount / duration) : 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-2xl bg-secondary/30">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <Badge className={`${getStatusColor(recording.status)} rounded-full`}>
                      {getStatusLabel(recording.status)}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
