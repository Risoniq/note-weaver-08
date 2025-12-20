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
  RefreshCw
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

  const fetchRecording = useCallback(async () => {
    if (!id) return null;
    
    try {
      const { data, error } = await supabase
        .from('recordings')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data as Recording | null;
    } catch (error) {
      console.error('Error fetching recording:', error);
      return null;
    }
  }, [id]);

  const syncRecordingStatus = useCallback(async () => {
    if (!id || !recording || recording.status === 'done' || recording.status === 'error') {
      return;
    }

    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-recording', {
        body: { id }
      });

      if (error) {
        console.error('Sync error:', error);
        return;
      }

      // Refetch the recording to get updated data
      const updatedRecording = await fetchRecording();
      if (updatedRecording) {
        setRecording(updatedRecording);
        
        // Show toast when status changes to done
        if (updatedRecording.status === 'done' && recording.status !== 'done') {
          toast.success("Aufnahme erfolgreich verarbeitet!");
        }
      }
    } catch (error) {
      console.error('Error syncing recording:', error);
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

  const generateFollowUpEmail = (recording: Recording): string => {
    const title = recording.title || `Meeting ${recording.meeting_id.slice(0, 8)}`;
    const date = format(new Date(recording.created_at), "dd. MMMM yyyy", { locale: de });
    
    let email = `Betreff: Follow-Up: ${title}\n\n`;
    email += `Liebe Kolleginnen und Kollegen,\n\n`;
    email += `vielen Dank für die Teilnahme am Meeting "${title}" am ${date}.\n\n`;
    
    if (recording.summary) {
      email += `**Zusammenfassung:**\n${recording.summary}\n\n`;
    }
    
    if (recording.key_points && recording.key_points.length > 0) {
      email += `**Wichtige Punkte:**\n`;
      recording.key_points.forEach((point, index) => {
        email += `${index + 1}. ${point}\n`;
      });
      email += `\n`;
    }
    
    if (recording.action_items && recording.action_items.length > 0) {
      email += `**Nächste Schritte:**\n`;
      recording.action_items.forEach((item) => {
        email += `☐ ${item}\n`;
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

  // Teilnehmer aus Transkript extrahieren
  const extractParticipants = (transcript: string | null): string[] => {
    if (!transcript) return [];
    const speakerPattern = /^([^:]+):/gm;
    const matches = transcript.match(speakerPattern);
    if (!matches) return [];
    const speakers = matches.map(m => m.replace(':', '').trim());
    return [...new Set(speakers)].filter(s => s !== 'Unbekannt');
  };
  
  const participants = extractParticipants(recording.transcript_text);
  const participantCount = participants.length > 0 ? participants.length : 
    (recording.transcript_text ? 1 : 0);

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
              Überblick über deine wichtigsten Kennzahlen
            </p>
          </div>
          <div className="flex items-center gap-3">
            {['pending', 'joining', 'recording', 'processing'].includes(recording.status) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={syncRecordingStatus}
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

        {/* Welcome Banner */}
        <div className="glass-card rounded-3xl p-6 mb-8 shadow-card animate-fade-in" style={{ animationDelay: '50ms' }}>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20">
              <Calendar className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="text-lg font-medium text-foreground">{formattedDate}</p>
              <div className="flex items-center gap-4 text-muted-foreground text-sm mt-1">
                {duration > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    {duration} Minuten
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Users className="h-4 w-4" />
                  {participantCount} Teilnehmer
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* KPI Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Teilnehmer Card */}
          <Card className="glass-card border-0 rounded-3xl shadow-card overflow-hidden animate-fade-in hover:shadow-lg transition-all hover:-translate-y-1" style={{ animationDelay: '100ms' }}>
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
              
              {/* Filter Pills */}
              <div className="flex flex-wrap gap-2 mb-4">
                {filterButtons.map((btn) => (
                  <button
                    key={btn.key}
                    onClick={() => setActiveFilter(btn.key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      activeFilter === btn.key
                        ? 'bg-primary text-primary-foreground shadow-primary'
                        : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>

              {/* Mini Chart Placeholder */}
              <div className="h-24 flex items-end gap-1">
                {[30, 45, 60, 80, 65, 90, participantCount * 20].map((h, i) => (
                  <div 
                    key={i} 
                    className="flex-1 bg-gradient-to-t from-accent/60 to-accent rounded-t-sm transition-all"
                    style={{ height: `${Math.min(h, 100)}%` }}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Key Points Card */}
          <Card className="glass-card border-0 rounded-3xl shadow-card overflow-hidden animate-fade-in hover:shadow-lg transition-all hover:-translate-y-1" style={{ animationDelay: '150ms' }}>
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
              
              {/* Filter Pills */}
              <div className="flex flex-wrap gap-2 mb-4">
                {filterButtons.map((btn) => (
                  <button
                    key={btn.key}
                    onClick={() => setActiveFilter(btn.key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      activeFilter === btn.key
                        ? 'bg-primary text-primary-foreground shadow-primary'
                        : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>

              {/* Area Chart */}
              <div className="h-24 relative">
                <svg className="w-full h-full" viewBox="0 0 100 40" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0,35 Q15,30 25,25 T50,15 T75,20 T100,10 V40 H0 Z"
                    fill="url(#chartGradient)"
                  />
                  <path
                    d="M0,35 Q15,30 25,25 T50,15 T75,20 T100,10"
                    fill="none"
                    stroke="hsl(var(--accent))"
                    strokeWidth="2"
                  />
                </svg>
              </div>
            </CardContent>
          </Card>

          {/* To-Dos Card */}
          <Card className="glass-card border-0 rounded-3xl shadow-card overflow-hidden animate-fade-in hover:shadow-lg transition-all hover:-translate-y-1" style={{ animationDelay: '200ms' }}>
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
              
              {/* Filter Pills */}
              <div className="flex flex-wrap gap-2 mb-4">
                {filterButtons.map((btn) => (
                  <button
                    key={btn.key}
                    onClick={() => setActiveFilter(btn.key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      activeFilter === btn.key
                        ? 'bg-primary text-primary-foreground shadow-primary'
                        : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>

              {/* Area Chart */}
              <div className="h-24 relative">
                <svg className="w-full h-full" viewBox="0 0 100 40" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="chartGradientGreen" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0,38 Q20,35 35,28 T60,18 T85,22 T100,12 V40 H0 Z"
                    fill="url(#chartGradientGreen)"
                  />
                  <path
                    d="M0,38 Q20,35 35,28 T60,18 T85,22 T100,12"
                    fill="none"
                    stroke="hsl(var(--success))"
                    strokeWidth="2"
                  />
                </svg>
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
                  <CardTitle className="flex items-center gap-3 text-lg">
                    <div className="p-2 rounded-xl bg-muted">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    </div>
                    Transkript
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-6 pb-6">
                  <div className="max-h-80 overflow-y-auto rounded-2xl bg-secondary/30 p-4">
                    <p className="text-foreground whitespace-pre-wrap text-sm leading-relaxed">
                      {recording.transcript_text}
                    </p>
                  </div>
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
