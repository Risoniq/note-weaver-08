import { useRef, useCallback, useState } from 'react';

interface SpeechRecognitionHook {
  isSupported: boolean;
  isActive: boolean;
  error: string;
  startRecognition: () => void;
  stopRecognition: () => void;
  setOnResult: (callback: (transcript: string) => void) => void;
}

export const useSpeechRecognition = (): SpeechRecognitionHook => {
  const recognitionRef = useRef<any>(null);
  const onResultCallbackRef = useRef<((transcript: string) => void) | null>(null);
  const [error, setError] = useState('');
  const [isActive, setIsActive] = useState(false);
  const isRecordingRef = useRef(false);
  const accumulatedTranscriptRef = useRef('');

  const isSupported = typeof window !== 'undefined' && 
    ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);

  const initializeRecognition = useCallback(() => {
    if (!isSupported) {
      setError('Speech Recognition wird von diesem Browser nicht unterstützt. Bitte nutze Chrome oder Edge.');
      return null;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'de-DE';

    recognition.onresult = (event: any) => {
      // Only process new results starting from event.resultIndex
      let newText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          newText += event.results[i][0].transcript;
        }
      }
      
      if (newText && onResultCallbackRef.current) {
        accumulatedTranscriptRef.current = accumulatedTranscriptRef.current
          ? accumulatedTranscriptRef.current + ' ' + newText.trim()
          : newText.trim();
        onResultCallbackRef.current(accumulatedTranscriptRef.current);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      switch (event.error) {
        case 'not-allowed':
          setError('Mikrofon-Zugriff wurde verweigert. Bitte erlaube den Zugriff in den Browser-Einstellungen.');
          setIsActive(false);
          break;
        case 'audio-capture':
          setError('Kein Mikrofon gefunden. Bitte überprüfe deine Audio-Einstellungen.');
          setIsActive(false);
          break;
        case 'network':
          setError('Netzwerkfehler bei der Spracherkennung. Bitte prüfe deine Internetverbindung.');
          setIsActive(false);
          break;
        case 'service-not-available':
          setError('Spracherkennungsdienst ist nicht erreichbar. Bitte versuche es später erneut.');
          setIsActive(false);
          break;
        case 'aborted':
          // Intentional stop, no error to show
          break;
        case 'no-speech':
          console.log('Keine Sprache erkannt, warte weiter...');
          break;
        default:
          console.warn('Unbekannter Speech Recognition Fehler:', event.error);
      }
    };

    recognition.onend = () => {
      if (isRecordingRef.current && recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          console.log('Recognition restart failed:', e);
          setIsActive(false);
        }
      } else {
        setIsActive(false);
      }
    };

    return recognition;
  }, [isSupported]);

  const startRecognition = useCallback(() => {
    accumulatedTranscriptRef.current = '';
    recognitionRef.current = initializeRecognition();
    
    if (recognitionRef.current) {
      isRecordingRef.current = true;
      setTimeout(() => {
        try {
          recognitionRef.current?.start();
          setIsActive(true);
          console.log('Speech recognition started');
        } catch (e) {
          console.error('Failed to start recognition:', e);
          setTimeout(() => {
            try {
              recognitionRef.current?.start();
              setIsActive(true);
              console.log('Speech recognition started (retry)');
            } catch (retryError) {
              console.error('Speech recognition retry failed:', retryError);
              setError('Spracherkennung konnte nicht gestartet werden. Bitte versuche es erneut.');
              setIsActive(false);
            }
          }, 500);
        }
      }, 800);
    }
  }, [initializeRecognition]);

  const stopRecognition = useCallback(() => {
    isRecordingRef.current = false;
    setIsActive(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.log('Recognition already stopped');
      }
    }
  }, []);

  const setOnResult = useCallback((callback: (transcript: string) => void) => {
    onResultCallbackRef.current = callback;
  }, []);

  return {
    isSupported,
    isActive,
    error,
    startRecognition,
    stopRecognition,
    setOnResult,
  };
};
