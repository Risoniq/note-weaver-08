import { useRef, useCallback, useState } from 'react';

interface SpeechRecognitionHook {
  isSupported: boolean;
  error: string;
  startRecognition: () => void;
  stopRecognition: () => void;
  setOnResult: (callback: (transcript: string) => void) => void;
}

export const useSpeechRecognition = (): SpeechRecognitionHook => {
  const recognitionRef = useRef<any>(null);
  const onResultCallbackRef = useRef<((transcript: string) => void) | null>(null);
  const [error, setError] = useState('');
  const isRecordingRef = useRef(false);

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
      const transcript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join(' ');
      
      if (onResultCallbackRef.current) {
        onResultCallbackRef.current(transcript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        setError('Mikrofon-Zugriff wurde verweigert. Bitte erlaube den Zugriff in den Browser-Einstellungen.');
      } else if (event.error === 'no-speech') {
        console.log('Keine Sprache erkannt, warte weiter...');
      }
    };

    recognition.onend = () => {
      if (isRecordingRef.current && recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          console.log('Recognition restart failed:', e);
        }
      }
    };

    return recognition;
  }, [isSupported]);

  const startRecognition = useCallback(() => {
    // Immer neue Recognition-Instanz erstellen für sauberen Start
    recognitionRef.current = initializeRecognition();
    
    if (recognitionRef.current) {
      isRecordingRef.current = true;
      // Längere Verzögerung um sicherzustellen, dass MediaRecorder das Mikrofon bereits hat
      setTimeout(() => {
        try {
          recognitionRef.current?.start();
          console.log('Speech recognition started');
        } catch (e) {
          console.error('Failed to start recognition:', e);
          // Bei Fehler nochmal versuchen
          setTimeout(() => {
            try {
              recognitionRef.current?.start();
              console.log('Speech recognition started (retry)');
            } catch (retryError) {
              console.error('Speech recognition retry failed:', retryError);
              setError('Spracherkennung konnte nicht gestartet werden. Bitte versuche es erneut.');
            }
          }, 500);
        }
      }, 800);
    }
  }, [initializeRecognition]);

  const stopRecognition = useCallback(() => {
    isRecordingRef.current = false;
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
    error,
    startRecognition,
    stopRecognition,
    setOnResult,
  };
};
