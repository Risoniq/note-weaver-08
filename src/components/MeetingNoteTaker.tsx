import { useState, useEffect, useRef, useCallback } from 'react';
import { Meeting, CaptureMode, ViewType } from '@/types/meeting';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useMeetingStorage } from '@/hooks/useMeetingStorage';
import { useAudioDevices } from '@/hooks/useAudioDevices';
import { useAudioLevel } from '@/hooks/useAudioLevel';
import { useMicrophoneTest } from '@/hooks/useMicrophoneTest';
import { useAuth } from '@/hooks/useAuth';
import { useUserQuota } from '@/hooks/useUserQuota';
import { generateAnalysis, downloadTranscript } from '@/utils/meetingAnalysis';
import { supabase } from '@/integrations/supabase/client';
import { getPendingIds, getBlob, deleteBlob } from '@/hooks/useIndexedDBBackup';
import { Header } from './meeting/Header';
import { ErrorAlert } from './meeting/ErrorAlert';
import { Navigation } from './meeting/Navigation';
import { RecordView } from './meeting/RecordView';
import { SearchBar } from './meeting/SearchBar';
import { MeetingCard } from './meeting/MeetingCard';
import { EmptyState } from './meeting/EmptyState';
import { MeetingDetailModal } from './meeting/MeetingDetailModal';
import { DownloadModal } from './meeting/DownloadModal';
import { CalendarView } from './calendar/CalendarView';
import { QuotaExhaustedModal } from './quota/QuotaExhaustedModal';
import { useToast } from '@/hooks/use-toast';

const MAX_CHUNK_BYTES = 500 * 1024 * 1024; // 500 MB

export default function MeetingNoteTaker() {
  const [isRecording, setIsRecording] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [meetingTitle, setMeetingTitle] = useState('');
  const [captureMode, setCaptureMode] = useState<CaptureMode>('tab');
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [downloadModalMeeting, setDownloadModalMeeting] = useState<Meeting | null>(null);
  const [currentStream, setCurrentStream] = useState<MediaStream | null>(null);
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const isStoppingRef = useRef(false); // H2: race condition lock
  const currentMeetingIdRef = useRef<string | null>(null); // H2: ID at start
  const totalChunkSizeRef = useRef(0); // M3: chunk size tracking
  
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const { quota } = useUserQuota();
  const { meetings, loadMeetings, saveMeeting, deleteMeeting, migrateLocalStorage } = useMeetingStorage();
  const { startRecognition, stopRecognition, setOnResult, error: recognitionError, isSupported: isSpeechSupported } = useSpeechRecognition();
  const audioDevices = useAudioDevices();
  const microphoneTest = useMicrophoneTest();
  const audioLevel = useAudioLevel(currentStream);

  // Retry pending IndexedDB uploads on mount
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    
    const retryPending = async () => {
      try {
        const ids = await getPendingIds();
        for (const id of ids) {
          const blob = await getBlob(id);
          if (!blob) { await deleteBlob(id); continue; }
          
          const extension = blob.type?.includes('webm') ? 'webm' : 'mp3';
          const filePath = `${user.id}/${id}.${extension}`;
          
          const { error: uploadError } = await supabase.storage
            .from('audio-uploads')
            .upload(filePath, blob, { contentType: blob.type || 'audio/webm', upsert: true });
          
          if (!uploadError) {
            // Update the recording's video_url to the storage path
            await supabase.from('recordings').update({ video_url: filePath, status: 'done' }).eq('id', id);
            await deleteBlob(id);
            console.log('Pending upload nachgeholt:', id);
          }
        }
      } catch (err) {
        console.warn('Pending upload retry failed:', err);
      }
    };
    
    retryPending();
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (isAuthenticated) {
      loadMeetings();
      migrateLocalStorage().then((count) => {
        if (count > 0) {
          toast({
            title: "Migration abgeschlossen",
            description: `${count} Meeting(s) wurden in die Cloud migriert`,
          });
          loadMeetings();
        }
      });
    }
    
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [loadMeetings, isAuthenticated, migrateLocalStorage, toast]);

  useEffect(() => {
    setOnResult((transcript) => {
      setCurrentTranscript(transcript);
    });
  }, [setOnResult]);

  useEffect(() => {
    if (recognitionError) {
      setError(recognitionError);
    }
  }, [recognitionError]);

  const startRecording = async () => {
    if (!isAuthenticated || !user) {
      setError('Bitte melde dich an, um eine Aufnahme zu starten');
      return;
    }

    // M1: Quota check before recording
    if (quota?.is_exhausted) {
      setShowQuotaModal(true);
      return;
    }

    if (!meetingTitle.trim()) {
      setError('Bitte gib einen Meeting-Titel ein');
      return;
    }

    // Stop any running microphone test
    if (microphoneTest.status === 'testing') {
      microphoneTest.stopTest();
    }

    // H2: Generate meeting ID at start, not at stop
    const meetingId = crypto.randomUUID();
    currentMeetingIdRef.current = meetingId;
    isStoppingRef.current = false;

    setError('');
    setIsRecording(true);
    setCurrentTranscript('');
    setRecordingStartTime(Date.now());
    audioChunksRef.current = [];
    totalChunkSizeRef.current = 0;
    try {
      let stream: MediaStream;

      if (captureMode === 'tab') {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });

        stream.getVideoTracks().forEach(track => track.stop());

        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length === 0) {
          stream.getTracks().forEach(track => track.stop());
          throw new Error('Kein Audio gefunden. Bitte aktiviere "Tab-Audio teilen" im Dialog oder nutze den Mikrofon-Modus.');
        }

        audioTracks[0].onended = () => {
          console.log('Audio stream ended');
          stopRecording();
        };
      } else {
        const deviceId = audioDevices.selectedMicId;
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            deviceId: deviceId !== 'default' ? { exact: deviceId } : undefined
          }
        });

        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length === 0) {
          throw new Error('Kein Mikrofon gefunden. Bitte überprüfe deine Audio-Einstellungen.');
        }

        console.log('Mikrofon aktiviert:', audioTracks[0].label);

        audioTracks[0].onended = () => {
          console.log('Microphone stream ended');
          stopRecording();
        };
      }

      streamRef.current = stream;
      setCurrentStream(stream);

      const mimeType = MediaRecorder.isTypeSupported('audio/mp3') 
        ? 'audio/mp3' 
        : MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm';
      
      console.log('Using audio mimeType:', mimeType);

      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          totalChunkSizeRef.current += event.data.size;
          // M3: Auto-stop at 500 MB
          if (totalChunkSizeRef.current >= MAX_CHUNK_BYTES) {
            toast({
              title: 'Speicherlimit erreicht',
              description: 'Die Aufnahme wurde automatisch beendet (500 MB). Bitte kürzere Aufnahmen erstellen.',
              variant: 'destructive',
            });
            stopRecording();
          }
        }
      };

      mediaRecorderRef.current.start(1000);
      
      if (isSpeechSupported) {
        await new Promise(resolve => setTimeout(resolve, 300));
        startRecognition();
      } else {
        toast({
          title: "Hinweis",
          description: "Echtzeit-Transkription ist in diesem Browser nicht verfügbar. Audio wird trotzdem aufgenommen und kann später transkribiert werden.",
        });
      }

      toast({
        title: "Aufnahme gestartet",
        description: `${captureMode === 'tab' ? 'Tab Audio' : 'Mikrofon'} wird aufgenommen`,
      });

    } catch (err: any) {
      console.error('Fehler beim Starten der Aufnahme:', err);
      setError(`Aufnahme konnte nicht gestartet werden: ${err.message}`);
      setIsRecording(false);
      setRecordingStartTime(null);
      setCurrentStream(null);
      currentMeetingIdRef.current = null;
    }
  };

  const stopRecording = useCallback(async () => {
    // H2: Lock to prevent double invocation
    if (isStoppingRef.current || !isRecording) return;
    isStoppingRef.current = true;
    
    setIsRecording(false);
    setCurrentStream(null);
    
    const duration = recordingStartTime ? Math.floor((Date.now() - recordingStartTime) / 1000) : 0;
    const title = meetingTitle;
    const transcript = currentTranscript;
    const mode = captureMode;
    const meetingId = currentMeetingIdRef.current || crypto.randomUUID();

    stopRecognition();

    const audioPromise = new Promise<Blob>((resolve) => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.onstop = () => {
          const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          console.log('Final audio blob created:', audioBlob.size, 'bytes, type:', mimeType);
          resolve(audioBlob);
        };
        mediaRecorderRef.current.stop();
      } else {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        resolve(audioBlob);
      }
    });

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    try {
      const audioBlob = await audioPromise;
      const audioUrl = URL.createObjectURL(audioBlob);

      const localAnalysis = generateAnalysis(transcript);

      const meeting: Meeting = {
        id: meetingId,
        title: title,
        date: new Date().toISOString(),
        transcript: transcript || 'Keine Transkription verfügbar',
        analysis: localAnalysis,
        captureMode: mode,
        duration: duration,
        audioBlob: audioBlob,
        audioUrl: audioUrl,
        user_id: user?.id,
        meeting_id: `notetaker_${meetingId}`,
        status: 'processing',
      };

      setDownloadModalMeeting(meeting);

      try {
        await saveMeeting(meeting);

        const doneMeeting: Meeting = { ...meeting, status: 'done' };
        await saveMeeting(doneMeeting);

        toast({
          title: "Aufnahme beendet",
          description: "Audio und Transkript wurden in der Cloud gespeichert",
        });
      } catch (saveErr) {
        console.error('Upload fehlgeschlagen, Blob in IndexedDB gesichert:', saveErr);
        toast({
          title: "Upload fehlgeschlagen",
          description: "Audio wurde lokal gesichert. Der Upload wird beim nächsten Start wiederholt. Du kannst die Datei auch manuell herunterladen.",
          variant: "destructive",
        });
      }

      // Try AI analysis in background
      if (transcript && transcript.trim().length > 0) {
        try {
          const { data, error } = await supabase.functions.invoke('analyze-notetaker', {
            body: { transcript, title, recording_id: meetingId }
          });
          if (!error && data?.success && data.analysis) {
            const updatedMeeting: Meeting = {
              ...meeting,
              status: 'done',
              analysis: data.analysis,
            };
            setDownloadModalMeeting(updatedMeeting);
            if (selectedMeeting?.id === meeting.id) {
              setSelectedMeeting(updatedMeeting);
            }
            await loadMeetings();
            toast({
              title: "KI-Analyse abgeschlossen",
              description: "Zusammenfassung und Action Items wurden erstellt",
            });
          } else if (data?.error) {
            console.warn('AI analysis failed:', data.error);
            toast({
              title: "KI-Analyse nicht verfügbar",
              description: data.error,
              variant: "destructive",
            });
          }
        } catch (aiErr) {
          console.warn('AI analysis error:', aiErr);
        }
      }
      setMeetingTitle('');
      setCurrentTranscript('');
      setRecordingStartTime(null);
      currentMeetingIdRef.current = null;

    } catch (err) {
      console.error('Fehler beim Speichern:', err);
      setError('Meeting konnte nicht gespeichert werden.');
    }
  }, [isRecording, recordingStartTime, meetingTitle, currentTranscript, captureMode, saveMeeting, stopRecognition, toast, user, selectedMeeting, loadMeetings]);

  const handleCloseDownloadModal = () => {
    setDownloadModalMeeting(null);
    setActiveView('dashboard');
  };

  const handleDeleteMeeting = async (id: string) => {
    if (window.confirm('Meeting wirklich löschen?')) {
      try {
        await deleteMeeting(id);
        if (selectedMeeting?.id === id) {
          setSelectedMeeting(null);
        }
        toast({
          title: "Meeting gelöscht",
          description: "Das Meeting wurde erfolgreich gelöscht",
        });
      } catch (err) {
        console.error('Fehler beim Löschen:', err);
      }
    }
  };

  const handleDownloadTranscript = (meeting: Meeting) => {
    downloadTranscript(meeting);
    toast({
      title: "Download gestartet",
      description: "Transkript wird heruntergeladen",
    });
  };

  const filteredMeetings = meetings.filter(m =>
    (m.title?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (m.transcript?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <Header />
        
        <ErrorAlert error={error} onClose={() => setError('')} />
        
        <Navigation activeView={activeView} onViewChange={setActiveView} />

        {activeView === 'record' && (
          <RecordView
            meetingTitle={meetingTitle}
            onTitleChange={setMeetingTitle}
            captureMode={captureMode}
            onCaptureModeChange={setCaptureMode}
            isRecording={isRecording}
            currentTranscript={currentTranscript}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
            audioDevices={audioDevices}
            microphoneTest={microphoneTest}
            audioLevel={audioLevel}
          />
        )}

        {activeView === 'dashboard' && (
          <>
            <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />
            
            {filteredMeetings.length > 0 ? (
              <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
                {filteredMeetings.map(meeting => (
                  <MeetingCard
                    key={meeting.id}
                    meeting={meeting}
                    onSelect={setSelectedMeeting}
                    onDownload={handleDownloadTranscript}
                    onDelete={handleDeleteMeeting}
                  />
                ))}
              </div>
            ) : (
              <EmptyState hasSearchTerm={!!searchTerm} />
            )}
          </>
        )}

        {activeView === 'calendar' && (
          <CalendarView />
        )}

        {selectedMeeting && (
          <MeetingDetailModal
            meeting={selectedMeeting}
            onClose={() => setSelectedMeeting(null)}
            onDownload={handleDownloadTranscript}
          />
        )}

        {downloadModalMeeting && (
          <DownloadModal
            meeting={downloadModalMeeting}
            onClose={handleCloseDownloadModal}
          />
        )}

        <QuotaExhaustedModal
          open={showQuotaModal}
          onClose={() => setShowQuotaModal(false)}
        />
      </div>
    </div>
  );
}
