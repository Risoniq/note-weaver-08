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
import { DownloadModal } from './meeting/DownloadModal';
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
  const [downloadModalMeeting, setDownloadModalMeeting] = useState<Meeting | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
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
    audioChunksRef.current = [];

    try {
      let stream: MediaStream;

      if (captureMode === 'tab') {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true, // Browser erfordert video: true
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });

        // Video-Track sofort stoppen (wir brauchen nur Audio)
        stream.getVideoTracks().forEach(track => track.stop());

        // Prüfen ob Audio-Track vorhanden
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
        // Mikrofon-Modus: System-Standard-Mikrofon verwenden
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            // Explizit das Standard-Mikrofon anfordern
            deviceId: 'default'
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

      // Try to use mp3 if available, otherwise webm
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
          console.log('Audio chunk received:', event.data.size, 'bytes');
        }
      };

      // Request data every second
      mediaRecorderRef.current.start(1000);
      
      // Kurze Verzögerung vor Speech Recognition Start, um Mikrofon-Konflikte zu vermeiden
      await new Promise(resolve => setTimeout(resolve, 300));
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
    if (!isRecording) return;
    
    setIsRecording(false);
    
    const duration = recordingStartTime ? Math.floor((Date.now() - recordingStartTime) / 1000) : 0;
    const title = meetingTitle;
    const transcript = currentTranscript;
    const mode = captureMode;

    stopRecognition();

    // Create a promise to wait for final audio data
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

      const meeting: Meeting = {
        id: Date.now().toString(),
        title: title,
        date: new Date().toISOString(),
        transcript: transcript || 'Keine Transkription verfügbar',
        analysis: generateAnalysis(transcript),
        captureMode: mode,
        duration: duration,
        audioBlob: audioBlob,
        audioUrl: audioUrl,
      };

      // Show download modal
      setDownloadModalMeeting(meeting);
      
      await saveMeeting(meeting);
      setMeetingTitle('');
      setCurrentTranscript('');
      setRecordingStartTime(null);
      
      toast({
        title: "Aufnahme beendet",
        description: "Audio und Transkript stehen zum Download bereit",
      });
    } catch (err) {
      console.error('Fehler beim Speichern:', err);
      setError('Meeting konnte nicht gespeichert werden.');
    }
  }, [isRecording, recordingStartTime, meetingTitle, currentTranscript, captureMode, saveMeeting, stopRecognition, toast]);

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

        {downloadModalMeeting && (
          <DownloadModal
            meeting={downloadModalMeeting}
            onClose={handleCloseDownloadModal}
          />
        )}
      </div>
    </div>
  );
}
