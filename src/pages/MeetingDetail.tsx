import { useEffect, useState } from "react";
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
  Sparkles
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";


export default function MeetingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [recording, setRecording] = useState<Recording | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedEmail, setCopiedEmail] = useState(false);

  useEffect(() => {
    const fetchRecording = async () => {
      if (!id) return;
      
      try {
        const { data, error } = await supabase
          .from('recordings')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;
        setRecording(data as Recording);
      } catch (error) {
        console.error('Error fetching recording:', error);
        toast.error("Meeting konnte nicht geladen werden");
        navigate('/');
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecording();
  }, [id, navigate]);

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
      recording.action_items.forEach((item, index) => {
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
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <Skeleton className="h-10 w-48 mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="h-64 lg:col-span-2" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </div>
    );
  }

  if (!recording) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
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
    (recording.transcript_text ? 1 : 0); // Mindestens 1 wenn Transkript vorhanden

  // KPIs berechnen
  const kpis = {
    wordsPerMinute: duration > 0 ? Math.round(wordCount / duration) : 0,
    avgKeyPointLength: keyPointsCount > 0 
      ? Math.round(recording.key_points!.reduce((acc, p) => acc + p.length, 0) / keyPointsCount)
      : 0,
    completionRate: recording.status === 'done' ? 100 : 
      recording.status === 'processing' ? 75 :
      recording.status === 'recording' ? 50 : 25,
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8 animate-fade-in">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate('/')}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-foreground truncate">
              {recording.title || `Meeting ${recording.meeting_id.slice(0, 8)}`}
            </h1>
            <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                <span>{formattedDate}</span>
              </div>
              {duration > 0 && (
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  <span>{duration} Minuten</span>
                </div>
              )}
            </div>
          </div>
          <Badge className={`shrink-0 ${getStatusColor(recording.status)}`}>
            {getStatusLabel(recording.status)}
          </Badge>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 animate-slide-up">
          <Card className="gradient-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{participantCount}</p>
                  <p className="text-xs text-muted-foreground">Teilnehmer</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="gradient-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/10">
                  <Target className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{keyPointsCount}</p>
                  <p className="text-xs text-muted-foreground">Key Points</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="gradient-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <CheckSquare className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{actionItemsCount}</p>
                  <p className="text-xs text-muted-foreground">To-Dos</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="gradient-card">
            <CardContent className="p-4">
              <div className="flex flex-col items-center gap-2">
                <div className="relative w-16 h-16">
                  <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    {/* Background circle */}
                    <circle
                      cx="18"
                      cy="18"
                      r="14"
                      fill="none"
                      stroke="hsl(var(--muted))"
                      strokeWidth="4"
                    />
                    {/* Participants segment (primary) */}
                    <circle
                      cx="18"
                      cy="18"
                      r="14"
                      fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth="4"
                      strokeDasharray={`${(participantCount / Math.max(participantCount + keyPointsCount + actionItemsCount, 1)) * 88} 88`}
                      strokeDashoffset="0"
                      className="transition-all duration-500"
                    />
                    {/* Key Points segment (accent) */}
                    <circle
                      cx="18"
                      cy="18"
                      r="14"
                      fill="none"
                      stroke="hsl(var(--accent))"
                      strokeWidth="4"
                      strokeDasharray={`${(keyPointsCount / Math.max(participantCount + keyPointsCount + actionItemsCount, 1)) * 88} 88`}
                      strokeDashoffset={`${-(participantCount / Math.max(participantCount + keyPointsCount + actionItemsCount, 1)) * 88}`}
                      className="transition-all duration-500"
                    />
                    {/* To-Dos segment (success) */}
                    <circle
                      cx="18"
                      cy="18"
                      r="14"
                      fill="none"
                      stroke="hsl(var(--success))"
                      strokeWidth="4"
                      strokeDasharray={`${(actionItemsCount / Math.max(participantCount + keyPointsCount + actionItemsCount, 1)) * 88} 88`}
                      strokeDashoffset={`${-((participantCount + keyPointsCount) / Math.max(participantCount + keyPointsCount + actionItemsCount, 1)) * 88}`}
                      className="transition-all duration-500"
                    />
                  </svg>
                </div>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="text-xs h-7 gap-1.5 hover:bg-primary hover:text-primary-foreground transition-colors"
                  onClick={() => toast.info("Deep Dive Analyse wird geladen...")}
                >
                  <Sparkles className="h-3 w-3" />
                  Deep Dive
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Key Points & Action Items */}
          <div className="lg:col-span-2 space-y-6">
            {/* Summary */}
            {recording.summary && (
              <Card className="animate-slide-up" style={{ animationDelay: '100ms' }}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    Zusammenfassung
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-foreground leading-relaxed">{recording.summary}</p>
                </CardContent>
              </Card>
            )}

            {/* Key Points */}
            {recording.key_points && recording.key_points.length > 0 && (
              <Card className="animate-slide-up" style={{ animationDelay: '150ms' }}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Target className="h-5 w-5 text-accent" />
                    Key Points
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {recording.key_points.map((point, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <span className="flex items-center justify-center h-6 w-6 rounded-full bg-accent/10 text-accent text-sm font-medium shrink-0">
                          {index + 1}
                        </span>
                        <span className="text-foreground">{point}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Action Items */}
            {recording.action_items && recording.action_items.length > 0 && (
              <Card className="animate-slide-up" style={{ animationDelay: '200ms' }}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <CheckSquare className="h-5 w-5 text-success" />
                    Action Items
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {recording.action_items.map((item, index) => (
                      <li key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                        <div className="h-5 w-5 rounded border-2 border-success/50 shrink-0 mt-0.5" />
                        <span className="text-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Transcript */}
            {recording.transcript_text && (
              <Card className="animate-slide-up" style={{ animationDelay: '250ms' }}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    Transkript
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-96 overflow-y-auto rounded-lg bg-muted/30 p-4">
                    <p className="text-foreground whitespace-pre-wrap text-sm leading-relaxed">
                      {recording.transcript_text}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Follow-Up & Video */}
          <div className="space-y-6">
            {/* Follow-Up Email */}
            <Card className="animate-slide-up" style={{ animationDelay: '100ms' }}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Mail className="h-5 w-5 text-primary" />
                  Follow-Up E-Mail
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Generierte Follow-Up E-Mail basierend auf dem Meeting-Inhalt.
                </p>
                <div className="max-h-64 overflow-y-auto rounded-lg bg-muted/30 p-3">
                  <pre className="text-xs text-foreground whitespace-pre-wrap font-sans">
                    {generateFollowUpEmail(recording)}
                  </pre>
                </div>
                <Button 
                  className="w-full" 
                  onClick={copyEmailToClipboard}
                  variant={copiedEmail ? "secondary" : "default"}
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
              <Card className="animate-slide-up" style={{ animationDelay: '150ms' }}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Video className="h-5 w-5 text-primary" />
                    Video
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                    <video 
                      src={recording.video_url} 
                      controls 
                      className="w-full h-full object-cover"
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Meeting Stats */}
            <Card className="animate-slide-up" style={{ animationDelay: '200ms' }}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BarChart3 className="h-5 w-5 text-accent" />
                  Meeting Statistiken
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Dauer</span>
                    <span className="font-medium text-foreground">{duration} Min</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Wortanzahl</span>
                    <span className="font-medium text-foreground">{wordCount.toLocaleString('de-DE')}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Wörter pro Minute</span>
                    <span className="font-medium text-foreground">{kpis.wordsPerMinute}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Verarbeitung</span>
                    <span className="font-medium text-foreground">{kpis.completionRate}%</span>
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
