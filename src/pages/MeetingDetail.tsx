import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { withTokenRefresh } from "@/lib/retryWithTokenRefresh";
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
  Replace,
  History,
  Download,
  Trash2
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";
import { ColoredTranscript, SpeakerLegend } from "@/components/transcript/ColoredTranscript";
import { SpeakerQualityBanner } from "@/components/transcript/SpeakerQualityBanner";
import { useSpeakerSuggestions } from "@/hooks/useSpeakerSuggestions";
import { extractSpeakersInOrder, createSpeakerColorMap, SPEAKER_COLORS } from "@/utils/speakerColors";
import { analyzeSpeakerQuality, SpeakerQualityResult } from "@/utils/speakerQuality";
import { getConsistentParticipantCount } from "@/utils/participantUtils";
import { EmailEditModal } from "@/components/meeting/EmailEditModal";
import { ReportDownloadModal } from "@/components/meeting/ReportDownloadModal";
import { DeepDiveModal } from "@/components/meeting/DeepDiveModal";
import { ProjectAssignment } from "@/components/meeting/ProjectAssignment";
import { useAuth } from "@/hooks/useAuth";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { EditableTitle } from "@/components/recordings/EditableTitle";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const titleJustUpdatedRef = useRef<boolean>(false);
  const lastUserEditedTitleRef = useRef<string | null>(null);
  
  // Speaker-Suggestions Hook
  const { suggestions: speakerSuggestions, saveSpeakerName } = useSpeakerSuggestions();
  
  // Transkript-Bearbeitung States
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);
  const [editedTranscript, setEditedTranscript] = useState('');
  const [isSavingTranscript, setIsSavingTranscript] = useState(false);
  const [showReplaceDialog, setShowReplaceDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [detectedSpeakers, setDetectedSpeakers] = useState<{ name: string; count: number; firstOccurrence: number }[]>([]);
  const [editingSpeaker, setEditingSpeaker] = useState<string | null>(null);
  const [newSpeakerName, setNewSpeakerName] = useState('');
  const [calendarAttendees, setCalendarAttendees] = useState<{ name: string; email: string }[]>([]);
  const [dbParticipantSuggestions, setDbParticipantSuggestions] = useState<{ id: string; name: string }[]>([]);
  const [expectedSpeakerCount, setExpectedSpeakerCount] = useState<number>(0);
  
  // E-Mail Bearbeitung States
  const [showEmailEditModal, setShowEmailEditModal] = useState(false);
  const [customEmail, setCustomEmail] = useState<string | null>(null);
  
  // Bericht Download States
  const [showReportModal, setShowReportModal] = useState(false);
  
  // Deep Dive Modal States
  const [showDeepDiveModal, setShowDeepDiveModal] = useState(false);
  
  // Resync Warning Dialog State
  const [showResyncWarning, setShowResyncWarning] = useState(false);
  
  // Video Transcription State
  const [isTranscribingVideo, setIsTranscribingVideo] = useState(false);
  const [isRecallTranscribing, setIsRecallTranscribing] = useState(false);
  
  // Soft-Delete State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Auth für User-Email
  const { user } = useAuth();
  const { isAdmin } = useAdminCheck();
  const { isImpersonating, impersonatedUserId } = useImpersonation();
  
  // Sprecher-Farben für Edit-Modus
  const speakerColorMap = useMemo(() => {
    const transcript = isEditingTranscript ? editedTranscript : (recording?.transcript_text || '');
    const speakers = extractSpeakersInOrder(transcript);
    return createSpeakerColorMap(speakers);
  }, [isEditingTranscript, editedTranscript, recording?.transcript_text]);

  // Sprecher-Qualitätsprüfung
  const speakerQuality = useMemo((): SpeakerQualityResult => {
    const transcript = recording?.transcript_text || '';
    const speakers = extractSpeakersInOrder(transcript);
    return analyzeSpeakerQuality(speakers, expectedSpeakerCount || undefined);
  }, [recording?.transcript_text, expectedSpeakerCount]);

  const fetchRecording = useCallback(async () => {
    if (!id) return null;
    
    try {
      // Wenn Admin impersoniert, Edge Function nutzen
      if (isAdmin && isImpersonating && impersonatedUserId) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return null;

        const { data, error } = await supabase.functions.invoke('admin-view-user-data', {
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: { 
            target_user_id: impersonatedUserId, 
            data_type: 'single_recording',
            recording_id: id 
          },
        });

        if (error) throw error;
        return data?.recording as Recording | null;
      }

      // Normale Abfrage für eigene Recordings
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
  }, [id, isAdmin, isImpersonating, impersonatedUserId]);

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
      // Frische Session holen für Auth-Header
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Session abgelaufen - versuche Refresh
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !refreshData.session) {
          toast.error("Sitzung abgelaufen. Bitte melde dich erneut an.");
          setIsSyncing(false);
          return;
        }
      }
      
      const activeSession = session || (await supabase.auth.getSession()).data.session;
      if (!activeSession) {
        toast.error("Sitzung abgelaufen. Bitte melde dich erneut an.");
        setIsSyncing(false);
        return;
      }

      const authHeaders = { Authorization: `Bearer ${activeSession.access_token}` };
      let invokeResult: { data: any; error: any };
      
      // Für manuelle Uploads: analyze-transcript aufrufen
      if (recording.source === 'manual') {
        invokeResult = await supabase.functions.invoke('analyze-transcript', {
          headers: authHeaders,
          body: { recording_id: id }
        });
      } else {
        // Für Bot-Aufnahmen: sync-recording aufrufen
        invokeResult = await supabase.functions.invoke('sync-recording', {
          headers: authHeaders,
          body: { id, force_resync: forceResync }
        });
      }

      if (invokeResult.error) {
        console.error('Sync/Analysis error:', invokeResult.error);
        
        // Bei 401: Session refreshen und nochmal versuchen
        const errorContext = invokeResult.error?.context;
        if (errorContext?.status === 401) {
          console.log('Token expired during sync, refreshing...');
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
          if (!refreshError && refreshData.session) {
            const retryHeaders = { Authorization: `Bearer ${refreshData.session.access_token}` };
            const retryResult = recording.source === 'manual'
              ? await supabase.functions.invoke('analyze-transcript', { headers: retryHeaders, body: { recording_id: id } })
              : await supabase.functions.invoke('sync-recording', { headers: retryHeaders, body: { id, force_resync: forceResync } });
            
            if (!retryResult.error) {
              // Retry war erfolgreich, weiter mit Success-Flow
              invokeResult = retryResult;
            } else {
              toast.error(recording.source === 'manual' 
                ? "Analyse fehlgeschlagen" 
                : "Synchronisierung fehlgeschlagen"
              );
              return;
            }
          } else {
            toast.error("Sitzung abgelaufen. Bitte melde dich erneut an.");
            return;
          }
        } else {
          toast.error(recording.source === 'manual' 
            ? "Analyse fehlgeschlagen" 
            : "Synchronisierung fehlgeschlagen"
          );
          return;
        }
      }

      // Refetch the recording to get updated data
      const updatedRecording = await fetchRecording();
      if (updatedRecording) {
        // Preserve local title if it was just updated by user (avoid race condition)
        if (titleJustUpdatedRef.current && lastUserEditedTitleRef.current !== null) {
          updatedRecording.title = lastUserEditedTitleRef.current;
        }
        setRecording(updatedRecording);
        
        if (forceResync) {
          toast.success(recording.source === 'manual'
            ? "Analyse wurde erfolgreich aktualisiert!"
            : "Transkript und Teilnehmernamen wurden aktualisiert!"
          );
        } else if (updatedRecording.status === 'done' && recording.status !== 'done') {
          toast.success("Aufnahme erfolgreich verarbeitet!");
        }
      }
    } catch (error) {
      console.error('Error syncing recording:', error);
      toast.error(recording.source === 'manual'
        ? "Analyse fehlgeschlagen"
        : "Synchronisierung fehlgeschlagen"
      );
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
    const email = customEmail || generateFollowUpEmail(recording);
    navigator.clipboard.writeText(email);
    setCopiedEmail(true);
    toast.success("E-Mail in Zwischenablage kopiert");
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  // Sprecher aus Transkript extrahieren - mit Unterscheidung von "Unbekannt" Sprechern
  const extractSpeakersFromTranscript = (transcript: string): { name: string; count: number; firstOccurrence: number }[] => {
    const speakerPattern = /^([A-Za-zÀ-ÿ\s\-\.0-9]+?):\s/gm;
    const speakerStats: Map<string, { count: number; firstOccurrence: number }> = new Map();
    let matchIndex = 0;
    
    let match;
    while ((match = speakerPattern.exec(transcript)) !== null) {
      const name = match[1].trim();
      if (name.length >= 2 && name.length <= 50) {
        if (!speakerStats.has(name)) {
          speakerStats.set(name, { count: 1, firstOccurrence: matchIndex });
        } else {
          speakerStats.get(name)!.count++;
        }
        matchIndex++;
      }
    }
    
    // Sortiere nach erster Vorkommensreihenfolge
    return Array.from(speakerStats.entries())
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => a.firstOccurrence - b.firstOccurrence);
  };

  // Automatisches Nummerieren von "Unbekannt" Sprechern
  const autoNumberUnknownSpeakers = (transcript: string): { numberedTranscript: string; count: number } => {
    const lines = transcript.split('\n');
    let currentUnknownNumber = 0;
    let lastSpeaker = '';
    const unknownMapping: Map<number, number> = new Map();
    
    // Erster Durchlauf: Analysiere Muster
    lines.forEach((line, index) => {
      const match = line.match(/^([A-Za-zÀ-ÿ\s\-\.0-9]+?):\s/);
      if (match) {
        const speaker = match[1].trim();
        if (speaker === 'Unbekannt') {
          if (lastSpeaker !== 'Unbekannt') {
            // Neuer unbekannter Sprecher beginnt
            currentUnknownNumber++;
          }
          unknownMapping.set(index, currentUnknownNumber);
        }
        lastSpeaker = speaker;
      }
    });
    
    // Zweiter Durchlauf: Ersetze
    const numberedLines = lines.map((line, index) => {
      if (unknownMapping.has(index)) {
        return line.replace(/^Unbekannt:\s/, `Sprecher ${unknownMapping.get(index)}: `);
      }
      return line;
    });
    
    return { numberedTranscript: numberedLines.join('\n'), count: currentUnknownNumber };
  };

  // Transkript bearbeiten Funktionen
  const startEditingTranscript = () => {
    if (recording?.transcript_text) {
      // Automatisch "Unbekannt" nummerieren
      const { numberedTranscript, count } = autoNumberUnknownSpeakers(recording.transcript_text);
      
      setEditedTranscript(numberedTranscript);
      setIsEditingTranscript(true);
      setDetectedSpeakers(extractSpeakersFromTranscript(numberedTranscript));
      
      if (count > 0) {
        toast.info(`${count} unbekannte Sprecher wurden automatisch nummeriert`);
      }
      
      // Lade Kalender-Teilnehmer aus dem Recording
      const rawRecording = recording as unknown as { 
        calendar_attendees?: { name: string; email: string }[];
        participants?: { id: string; name: string }[];
      };
      if (rawRecording.calendar_attendees && Array.isArray(rawRecording.calendar_attendees)) {
        setCalendarAttendees(rawRecording.calendar_attendees);
        // Erwartete Sprecheranzahl = Kalender-Teilnehmer
        setExpectedSpeakerCount(rawRecording.calendar_attendees.length);
      }
      // Lade DB-Teilnehmer als Vorschläge (Speaker-IDs von Recall.ai)
      if (rawRecording.participants && Array.isArray(rawRecording.participants)) {
        const validParticipants = rawRecording.participants.filter(p => 
          p.name && p.name.trim() !== '' && !p.name.startsWith('Sprecher ') && p.name !== 'Unbekannt'
        );
        setDbParticipantSuggestions(validParticipants);
        // Falls keine Kalender-Teilnehmer, nutze DB-Teilnehmer für Erwartung
        if (!rawRecording.calendar_attendees?.length && validParticipants.length > 0) {
          setExpectedSpeakerCount(validParticipants.length);
        }
      }
    }
  };

  const cancelEditingTranscript = () => {
    setIsEditingTranscript(false);
    setEditedTranscript('');
    setShowReplaceDialog(false);
    setSearchTerm('');
    setReplaceTerm('');
    setDetectedSpeakers([]);
    setEditingSpeaker(null);
    setNewSpeakerName('');
    setCalendarAttendees([]);
    setDbParticipantSuggestions([]);
    setExpectedSpeakerCount(0);
  };

  // Sprecher im gesamten Transkript umbenennen
  const renameSpeaker = (oldName: string, newName: string) => {
    if (!newName.trim() || oldName === newName) {
      setEditingSpeaker(null);
      setNewSpeakerName('');
      return;
    }
    
    // Ersetze alle Vorkommen des Sprechernamens (als Sprecher-Label)
    const pattern = new RegExp(`^(${oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}):\\s`, 'gm');
    const newTranscript = editedTranscript.replace(pattern, `${newName}: `);
    
    // Zähle Ersetzungen
    const replacements = (editedTranscript.match(pattern) || []).length;
    
    setEditedTranscript(newTranscript);
    
    // Aktualisiere die Sprecher-Liste
    setDetectedSpeakers(prev => 
      prev.map(s => s.name === oldName ? { ...s, name: newName } : s)
    );
    
    setEditingSpeaker(null);
    setNewSpeakerName('');
    
    // Speichere den neuen Namen für zukünftige Vorschläge (ignoriert generische Namen automatisch)
    saveSpeakerName(newName);
    
    toast.success(`"${oldName}" wurde ${replacements}x durch "${newName}" ersetzt`);
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
      const { error: analyzeError } = await withTokenRefresh(
        () => supabase.functions.invoke('analyze-transcript', {
          body: { recording_id: id }
        })
      );

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

  // Zentrale Teilnehmerzählung (Single Source of Truth)
  const participantResult = getConsistentParticipantCount({
    participants: recording.participants as { id: string; name: string }[] | null,
    transcript_text: recording.transcript_text,
  });
  
  const participantCount = participantResult.count;
  const participantNames = participantResult.names;

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
            <EditableTitle
              recordingId={recording.id}
              title={recording.title}
              meetingId={recording.meeting_id}
              size="large"
              onTitleChange={(newTitle) => {
                // 1. Flags setzen um Auto-Sync zu blockieren
                titleJustUpdatedRef.current = true;
                lastUserEditedTitleRef.current = newTitle;
                
                // 2. Lokalen State sofort aktualisieren
                setRecording(prev => prev ? { ...prev, title: newTitle } : null);
                
                // 3. customEmail zurücksetzen → Follow-Up wird neu generiert mit neuem Titel
                setCustomEmail(null);
                
                // 4. Transkript-Header wird automatisch durch DB-Trigger aktualisiert
                // Kein Frontend-Update nötig - Single Source of Truth in der Datenbank
                
                // 5. Flags nach 10s zurücksetzen (genug Zeit für Auto-Sync)
                setTimeout(() => {
                  titleJustUpdatedRef.current = false;
                  lastUserEditedTitleRef.current = null;
                }, 10000);
              }}
            />
            <p className="text-muted-foreground mt-1">
              {format(new Date(recording.created_at), "EEEE, dd. MMMM yyyy 'um' HH:mm 'Uhr'", { locale: de })}
            </p>
            <div className="mt-2">
              <ProjectAssignment recordingId={recording.id} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Video transkribieren Button */}
            {recording.video_url && !recording.transcript_text && recording.status !== 'transcribing' && !isTranscribingVideo && (
              <Button
                variant="default"
                size="sm"
                onClick={async () => {
                  if (recording.duration && recording.duration > 3600) {
                    toast.warning("Dieses Meeting ist über 60 Minuten lang. Die Video-Transkription kann bei sehr langen Meetings fehlschlagen. Möchtest du es trotzdem versuchen?");
                  }
                  setIsTranscribingVideo(true);
                  try {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session) {
                      toast.error("Sitzung abgelaufen");
                      setIsTranscribingVideo(false);
                      return;
                    }
                    toast.info("Video wird im Hintergrund transkribiert... Das kann einige Minuten dauern.");
                    const { error } = await supabase.functions.invoke('transcribe-video', {
                      headers: { Authorization: `Bearer ${session.access_token}` },
                      body: { recording_id: recording.id },
                    });
                    if (error) throw error;
                    setRecording(prev => prev ? { ...prev, status: 'transcribing' } : null);
                    const pollInterval = setInterval(async () => {
                      const updated = await fetchRecording();
                      if (updated) {
                        setRecording(updated);
                        if (updated.status === 'done' || updated.status === 'error') {
                          clearInterval(pollInterval);
                          setIsTranscribingVideo(false);
                          if (updated.status === 'done') toast.success("Transkription abgeschlossen!");
                          else toast.error("Transkription fehlgeschlagen");
                        }
                      }
                    }, 15000);
                  } catch (err) {
                    console.error('Video transcription error:', err);
                    toast.error("Video-Transkription fehlgeschlagen");
                    setIsTranscribingVideo(false);
                  }
                }}
                className="rounded-xl"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Video transkribieren
              </Button>
            )}
            {/* Recall.ai Transkript erstellen Button */}
            {recording.source === 'bot' && !recording.transcript_text && recording.recall_bot_id && recording.status !== 'transcribing' && !isTranscribingVideo && !isRecallTranscribing && (
              <Button
                variant="default"
                size="sm"
                onClick={async () => {
                  setIsRecallTranscribing(true);
                  try {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session) {
                      toast.error("Sitzung abgelaufen");
                      setIsRecallTranscribing(false);
                      return;
                    }
                    const { data, error } = await supabase.functions.invoke('recall-transcribe', {
                      headers: { Authorization: `Bearer ${session.access_token}` },
                      body: { recording_id: recording.id },
                    });
                    if (error) throw error;
                    setRecording(prev => prev ? { ...prev, status: 'transcribing' } : null);
                    toast.success("Recall.ai Transkription gestartet! Klicke in 1-2 Minuten auf 'Transkript neu laden'.");
                  } catch (err) {
                    console.error('Recall transcription error:', err);
                    toast.error("Recall Transkription fehlgeschlagen");
                  } finally {
                    setIsRecallTranscribing(false);
                  }
                }}
                className="rounded-xl"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Recall Transkript erstellen
              </Button>
            )}
            {isRecallTranscribing && (
              <Button variant="outline" size="sm" disabled className="rounded-xl">
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Recall Transkription...
              </Button>
            )}
            {isTranscribingVideo && (
              <Button variant="outline" size="sm" disabled className="rounded-xl">
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Transkribiere...
              </Button>
            )}
            {/* Re-Sync Button für abgeschlossene Meetings */}
            {['done', 'error', 'transcribing'].includes(recording.status) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowResyncWarning(true)}
                disabled={isSyncing}
                className="rounded-xl hover:bg-primary/10 transition-all"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Aktualisiere...' : 'Transkript neu laden'}
              </Button>
            )}
            {/* Status-Sync für laufende Meetings */}
            {['pending', 'joining', 'recording', 'processing', 'transcribing'].includes(recording.status) && (
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
            {/* Löschen-Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowDeleteConfirm(true)}
              className="shrink-0 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
              title="Meeting löschen"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
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

            {/* Transcript Toolbar + Card */}
            {recording.transcript_text && (
              <>
                {/* Toolbar über dem Transkript */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-secondary/30 animate-fade-in" style={{ animationDelay: '380ms' }}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => syncRecordingStatus(true)}
                    disabled={isSyncing}
                    className="rounded-xl hover:bg-primary/10 transition-all"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? 'Aktualisiere...' : 'Transkript neu laden'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowReportModal(true)}
                    className="rounded-xl"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Bericht herunterladen
                  </Button>
                </div>

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
                  {/* Erkannte Sprecher - Schnellbearbeitung */}
                  {isEditingTranscript && detectedSpeakers.length > 0 && (
                    <div className="p-4 rounded-2xl bg-secondary/50 border border-border space-y-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm font-medium text-foreground">Erkannte Sprecher</p>
                        <span className="text-xs text-muted-foreground">
                          (Klicke zum Umbenennen)
                        </span>
                        {expectedSpeakerCount > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {detectedSpeakers.length} von {expectedSpeakerCount} Teilnehmern erkannt
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {detectedSpeakers.map((speakerData) => {
                          const color = speakerColorMap.get(speakerData.name) || SPEAKER_COLORS[0];
                          return (
                          <div key={speakerData.name} className="relative">
                            {editingSpeaker === speakerData.name ? (
                              <div className="flex flex-col gap-2 bg-background border border-primary rounded-xl p-2 min-w-[220px] z-10 shadow-lg">
                                <input
                                  type="text"
                                  value={newSpeakerName}
                                  onChange={(e) => setNewSpeakerName(e.target.value)}
                                  placeholder={speakerData.name}
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') renameSpeaker(speakerData.name, newSpeakerName);
                                    if (e.key === 'Escape') { setEditingSpeaker(null); setNewSpeakerName(''); }
                                  }}
                                  className="px-3 py-2 text-sm bg-secondary/50 rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50 w-full"
                                />
                                
                                {/* Historische Sprechervorschläge aus DB */}
                                {speakerSuggestions.length > 0 && (
                                  <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground px-1 flex items-center gap-1">
                                      <History className="h-3 w-3" />
                                      Zuletzt verwendet:
                                    </p>
                                    <div className="max-h-24 overflow-y-auto space-y-1">
                                      {speakerSuggestions
                                        .filter(s => s.name.toLowerCase() !== speakerData.name.toLowerCase())
                                        .slice(0, 5)
                                        .map((suggestion, idx) => (
                                          <button
                                            key={`hist-${idx}`}
                                            onClick={() => {
                                              setNewSpeakerName(suggestion.name);
                                              renameSpeaker(speakerData.name, suggestion.name);
                                            }}
                                            className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-primary/10 transition-colors flex items-center justify-between gap-2"
                                          >
                                            <span className="truncate">{suggestion.name}</span>
                                            <span className="text-[10px] text-muted-foreground">{suggestion.usage_count}×</span>
                                          </button>
                                        ))
                                      }
                                    </div>
                                  </div>
                                )}
                                
                                {/* DB-Teilnehmer Vorschläge (echte Namen aus Recall.ai) */}
                                {dbParticipantSuggestions.length > 0 && (
                                  <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground px-1">Erkannte Teilnehmer:</p>
                                    <div className="max-h-32 overflow-y-auto space-y-1">
                                      {dbParticipantSuggestions
                                        .filter(p => p.name.toLowerCase() !== speakerData.name.toLowerCase())
                                        .map((participant, idx) => (
                                          <button
                                            key={idx}
                                            onClick={() => {
                                              setNewSpeakerName(participant.name);
                                              renameSpeaker(speakerData.name, participant.name);
                                            }}
                                            className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-primary/10 transition-colors flex items-center gap-2"
                                          >
                                            <Users className="h-3 w-3 text-primary shrink-0" />
                                            <span className="truncate">{participant.name}</span>
                                          </button>
                                        ))
                                      }
                                    </div>
                                  </div>
                                )}
                                
                                {/* Kalender-Vorschläge */}
                                {calendarAttendees.length > 0 && (
                                  <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground px-1">Aus Kalender:</p>
                                    <div className="max-h-32 overflow-y-auto space-y-1">
                                      {calendarAttendees
                                        .filter(a => a.name.toLowerCase() !== speakerData.name.toLowerCase())
                                        .map((attendee, idx) => (
                                          <button
                                            key={`cal-${idx}`}
                                            onClick={() => {
                                              setNewSpeakerName(attendee.name);
                                              renameSpeaker(speakerData.name, attendee.name);
                                            }}
                                            className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-accent/10 transition-colors flex items-center gap-2"
                                          >
                                            <Calendar className="h-3 w-3 text-accent shrink-0" />
                                            <span className="truncate">{attendee.name}</span>
                                          </button>
                                        ))
                                      }
                                    </div>
                                  </div>
                                )}
                                
                                <div className="flex justify-end gap-1 pt-1 border-t border-border">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-xs"
                                    onClick={() => { setEditingSpeaker(null); setNewSpeakerName(''); }}
                                  >
                                    Abbrechen
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="h-7 px-2 text-xs"
                                    onClick={() => renameSpeaker(speakerData.name, newSpeakerName)}
                                  >
                                    <Check className="h-3 w-3 mr-1" />
                                    Anwenden
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <Badge
                                className="cursor-pointer hover:opacity-80 transition-colors flex items-center gap-1"
                                style={{ 
                                  backgroundColor: color.bg,
                                  color: color.text,
                                  border: `1px solid ${color.border}`,
                                }}
                                onClick={() => { setEditingSpeaker(speakerData.name); setNewSpeakerName(speakerData.name); }}
                              >
                                {speakerData.name}
                                <span className="text-[10px] opacity-60">({speakerData.count}×)</span>
                                <Edit3 className="h-3 w-3 ml-1 opacity-50" />
                              </Badge>
                            )}
                          </div>
                        )})}
                      </div>
                      {calendarAttendees.length > 0 && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />
                          {calendarAttendees.length} Teilnehmer aus dem Kalender verfügbar
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Änderungen werden automatisch im gesamten Transkript übernommen.
                      </p>
                    </div>
                  )}

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
                    <>
                      {/* Sprecher-Qualitäts-Banner */}
                      <SpeakerQualityBanner
                        quality={speakerQuality}
                        onEditClick={startEditingTranscript}
                        className="mb-4"
                      />
                      <div className="max-h-[500px] overflow-y-auto rounded-2xl bg-secondary/30 p-4">
                        {/* Farbige Transkript-Anzeige mit Sprecher-Badges */}
                        <ColoredTranscript transcript={recording.transcript_text} />
                      </div>
                    </>
                  )}
                  
                  {isEditingTranscript && (
                    <p className="text-xs text-muted-foreground">
                      Tipp: Nutze "Ersetzen" um alle Vorkommen eines Namens (z.B. "Sprecher 1") durch den echten Namen zu ersetzen. Nach dem Speichern wird die Analyse automatisch aktualisiert.
                    </p>
                  )}
                </CardContent>
              </Card>
              </>
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
                    onClick={() => setShowDeepDiveModal(true)}
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
                  {customEmail ? 'Mit KI bearbeitete E-Mail' : 'Automatisch generierte Follow-Up E-Mail'}
                </p>
                <div className="max-h-48 overflow-y-auto rounded-2xl bg-secondary/30 p-4">
                  <pre className="text-xs text-foreground whitespace-pre-wrap font-sans">
                    {customEmail || generateFollowUpEmail(recording)}
                  </pre>
                </div>
                <div className="flex gap-2">
                  <Button 
                    className="flex-1 rounded-xl" 
                    variant="outline"
                    onClick={() => setShowEmailEditModal(true)}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Mit KI bearbeiten
                  </Button>
                  <Button 
                    className="flex-1 rounded-xl" 
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
                        Kopieren
                      </>
                    )}
                  </Button>
                </div>
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
                  <div className="mt-4">
                    <Button variant="outline" asChild>
                      <a href={recording.video_url} target="_blank" rel="noopener noreferrer">
                        <Download className="h-4 w-4 mr-2" />
                        Video herunterladen
                      </a>
                    </Button>
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
      
      {/* Email Edit Modal */}
      <EmailEditModal
        open={showEmailEditModal}
        onOpenChange={setShowEmailEditModal}
        currentEmail={customEmail || generateFollowUpEmail(recording)}
        onEmailUpdate={(newEmail) => setCustomEmail(newEmail)}
        recordingContext={{
          title: recording.title || undefined,
          summary: recording.summary || undefined,
          key_points: recording.key_points || undefined,
          action_items: recording.action_items || undefined,
        }}
      />
      
      {/* Report Download Modal */}
      <ReportDownloadModal
        open={showReportModal}
        onOpenChange={setShowReportModal}
        recording={{
          id: recording.id,
          title: recording.title,
          created_at: recording.created_at,
          summary: recording.summary,
          key_points: recording.key_points,
          action_items: recording.action_items,
          transcript_text: recording.transcript_text,
          participants: recording.participants as { id: string; name: string }[] | null,
          duration: recording.duration,
          word_count: recording.word_count,
          meeting_url: recording.meeting_url,
        }}
        followUpEmail={customEmail || generateFollowUpEmail(recording)}
      />
      
      {/* Deep Dive Modal */}
      <DeepDiveModal
        open={showDeepDiveModal}
        onOpenChange={setShowDeepDiveModal}
        transcript={recording.transcript_text}
        userEmail={user?.email || null}
        meetingTitle={recording.title || undefined}
        summary={recording.summary || undefined}
        keyPoints={recording.key_points || undefined}
        actionItems={recording.action_items || undefined}
      />
      
      {/* Resync Warning Dialog */}
      <AlertDialog open={showResyncWarning} onOpenChange={setShowResyncWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transkript neu laden?</AlertDialogTitle>
            <AlertDialogDescription>
              Das Transkript wird von der Aufnahmequelle neu abgerufen. 
              Manuelle Änderungen an Sprechernamen gehen dabei verloren.
              <br /><br />
              <strong>Der Meeting-Titel bleibt erhalten.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setShowResyncWarning(false);
              syncRecordingStatus(true);
            }}>
              Neu laden
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Soft-Delete Bestätigungs-Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Meeting löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Das Meeting wird aus deinem Dashboard entfernt. 
              Ein Administrator kann es bei Bedarf wiederherstellen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                setIsDeleting(true);
                try {
                  const { error } = await supabase
                    .from('recordings')
                    .update({ deleted_at: new Date().toISOString() } as any)
                    .eq('id', recording.id);
                  if (error) throw error;
                  toast.success("Meeting gelöscht");
                  navigate('/');
                } catch (err) {
                  console.error('Soft-delete error:', err);
                  toast.error("Löschen fehlgeschlagen");
                } finally {
                  setIsDeleting(false);
                  setShowDeleteConfirm(false);
                }
              }}
            >
              {isDeleting ? 'Lösche...' : 'Löschen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
