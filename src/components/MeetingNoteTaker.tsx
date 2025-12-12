import { useState, useEffect, useRef, useCallback } from 'react';
import { Meeting, CaptureMode, ViewType } from '@/types/meeting';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useMeetingStorage } from '@/hooks/useMeetingStorage';
import { generateAnalysis, downloadTranscript } from '@/utils/meetingAnalysis';
import { Header } from './meeting/Header';
import { ErrorAlert } from './meeting/ErrorAlert';
import { Navigation } from './meeting/Navigation';
import { RecordView } from './meeting/RecordView';
import { SearchBar } from './meeting/SearchBar';
import { MeetingCard } from './meeting/MeetingCard';
import { EmptyState } from './meeting/EmptyState';
import { MeetingDetailModal } from './meeting/MeetingDetailModal';
import { useToast } from '@/hooks/use-toast';

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
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const { toast } = useToast();
  const { meetings, loadMeetings, saveMeeting, deleteMeeting } = useMeetingStorage();
  const { startRecognition, stopRecognition, setOnResult, error: recognitionError } = useSpeechRecognition();

  useEffect(() => {
    loadMeetings();
    
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [loadMeetings]);

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
    if (!meetingTitle.trim()) {
      setError('Bitte gib einen Meeting-Titel ein');
      return;
    }

    setError('');
    setIsRecording(true);
    setCurrentTranscript('');
    setRecordingStartTime(Date.now());

    try {
      let stream: MediaStream;

      if (captureMode === 'tab') {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: false,
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        } as any);

        stream.getAudioTracks()[0].onended = () => {
          console.log('Audio stream ended');
          if (isRecording) {
            stopRecording();
          }
        };
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
      }

      streamRef.current = stream;

      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });
      
      mediaRecorderRef.current.start();
      startRecognition();

      toast({
        title: "Aufnahme gestartet",
        description: `${captureMode === 'tab' ? 'Tab Audio' : 'Mikrofon'} wird aufgenommen`,
      });

    } catch (err: any) {
      console.error('Fehler beim Starten der Aufnahme:', err);
      setError(`Aufnahme konnte nicht gestartet werden: ${err.message}`);
      setIsRecording(false);
      setRecordingStartTime(null);
    }
  };

  const stopRecording = useCallback(async () => {
    setIsRecording(false);
    
    const duration = recordingStartTime ? Math.floor((Date.now() - recordingStartTime) / 1000) : 0;

    stopRecognition();

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    const meeting: Meeting = {
      id: Date.now().toString(),
      title: meetingTitle,
      date: new Date().toISOString(),
      transcript: currentTranscript || 'Keine Transkription verfügbar',
      analysis: generateAnalysis(currentTranscript),
      captureMode: captureMode,
      duration: duration
    };

    try {
      await saveMeeting(meeting);
      setMeetingTitle('');
      setCurrentTranscript('');
      setRecordingStartTime(null);
      setActiveView('dashboard');
      
      toast({
        title: "Meeting gespeichert",
        description: `"${meeting.title}" wurde erfolgreich gespeichert`,
      });
    } catch (err) {
      console.error('Fehler beim Speichern:', err);
      setError('Meeting konnte nicht gespeichert werden.');
    }
  }, [recordingStartTime, meetingTitle, currentTranscript, captureMode, saveMeeting, stopRecognition, toast]);

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
    m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.transcript.toLowerCase().includes(searchTerm.toLowerCase())
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

        {selectedMeeting && (
          <MeetingDetailModal
            meeting={selectedMeeting}
            onClose={() => setSelectedMeeting(null)}
            onDownload={handleDownloadTranscript}
          />
        )}
      </div>
    </div>
  );
}
