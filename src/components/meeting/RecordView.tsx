import { Mic, Square, Radio, Lightbulb, AlertTriangle } from 'lucide-react';
import { CaptureMode } from '@/types/meeting';
import { AudioDevices } from '@/hooks/useAudioDevices';
import { MicrophoneTest } from '@/hooks/useMicrophoneTest';
import { AudioDeviceSelector } from './AudioDeviceSelector';
import { MicrophoneTestButton } from './MicrophoneTestButton';
import { AudioLevelIndicator } from './AudioLevelIndicator';

const isSpeechRecognitionSupported = typeof window !== 'undefined' && 
  ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);

interface RecordViewProps {
  meetingTitle: string;
  onTitleChange: (title: string) => void;
  captureMode: CaptureMode;
  onCaptureModeChange: (mode: CaptureMode) => void;
  isRecording: boolean;
  currentTranscript: string;
  onStartRecording: () => void;
  onStopRecording: () => void;
  audioDevices: AudioDevices;
  microphoneTest: MicrophoneTest;
  audioLevel: number;
}

export const RecordView = ({
  meetingTitle,
  onTitleChange,
  captureMode,
  onCaptureModeChange,
  isRecording,
  currentTranscript,
  onStartRecording,
  onStopRecording,
  audioDevices,
  microphoneTest,
  audioLevel,
}: RecordViewProps) => {
  return (
    <div className="bg-card rounded-2xl shadow-lg border border-border p-6 sm:p-8 animate-fade-in">
      <h2 className="text-xl sm:text-2xl font-bold mb-6 text-foreground">Meeting transkribieren</h2>

      {/* Browser Compatibility Banner */}
      {!isSpeechRecognitionSupported && (
        <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertTriangle size={20} className="text-warning flex-shrink-0 mt-0.5" />
          <p className="text-sm text-foreground">
            Dein Browser unterstützt keine Echtzeit-Transkription. Verwende Chrome oder Edge für Live-Transkripte, oder nimm auf – die Transkription erfolgt nach dem Upload.
          </p>
        </div>
      )}
      
      {/* Audio Device Selection */}
      {!isRecording && (
        <div className="bg-muted/30 border border-border rounded-xl p-5 sm:p-6 mb-6">
          <AudioDeviceSelector 
            devices={audioDevices}
            disabled={isRecording}
          />
          <div className="mt-4 pt-4 border-t border-border">
            <MicrophoneTestButton 
              test={microphoneTest}
              selectedMicId={audioDevices.selectedMicId}
              disabled={isRecording}
            />
          </div>
        </div>
      )}

      {/* Capture Mode Selection */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 sm:p-6 mb-6">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <Radio size={18} className="text-primary" />
          Aufnahmemodus wählen
        </h3>
        <div className="space-y-3">
          <label className="flex items-start gap-4 cursor-pointer group">
            <input
              type="radio"
              name="captureMode"
              value="tab"
              checked={captureMode === 'tab'}
              onChange={(e) => onCaptureModeChange(e.target.value as CaptureMode)}
              disabled={isRecording}
              className="w-5 h-5 mt-0.5 flex-shrink-0 accent-primary"
            />
            <div className="flex-1">
              <div className="font-medium text-foreground group-hover:text-primary transition-colors">
                Tab/System Audio (Empfohlen)
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Nimmt den Audio vom Meeting-Tab auf - funktioniert parallel zu deinem Meeting
              </p>
            </div>
          </label>
          
          <label className="flex items-start gap-4 cursor-pointer group">
            <input
              type="radio"
              name="captureMode"
              value="mic"
              checked={captureMode === 'mic'}
              onChange={(e) => onCaptureModeChange(e.target.value as CaptureMode)}
              disabled={isRecording}
              className="w-5 h-5 mt-0.5 flex-shrink-0 accent-primary"
            />
            <div className="flex-1">
              <div className="font-medium text-foreground group-hover:text-primary transition-colors flex items-center gap-2">
                <Mic size={16} />
                Nur Mikrofon
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Nimmt nur dein Mikrofon auf - kann Konflikte verursachen
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Meeting Title Input */}
      <input
        type="text"
        value={meetingTitle}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="z.B. Sprint Planning, Kundengespräch..."
        className="w-full p-4 border border-border bg-background rounded-xl mb-6 text-base sm:text-lg focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all placeholder:text-muted-foreground"
        disabled={isRecording}
      />

      {/* Record Button */}
      <div className="flex justify-center mb-6">
        {!isRecording ? (
          <button
            onClick={onStartRecording}
            className="flex items-center gap-3 px-8 py-4 gradient-recording text-primary-foreground rounded-full text-lg font-semibold hover:opacity-90 transition-all shadow-recording hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <Mic size={24} />
            Transkription starten
          </button>
        ) : (
          <button
            onClick={onStopRecording}
            className="flex items-center gap-3 px-8 py-4 bg-foreground text-background rounded-full text-lg font-semibold hover:opacity-90 transition-all shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <Square size={24} />
            Beenden & Speichern
          </button>
        )}
      </div>

      {/* Recording Status */}
      {isRecording && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-5 sm:p-6 animate-scale-in">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-destructive rounded-full animate-pulse-recording"></div>
              <span className="text-destructive font-semibold">
                🎤 Aufnahme läuft... ({captureMode === 'tab' ? 'Tab Audio' : 'Mikrofon'})
              </span>
            </div>
            <AudioLevelIndicator level={audioLevel} className="w-24" />
          </div>
          <div className="bg-background rounded-xl p-4 max-h-64 overflow-y-auto border border-border">
            <p className="text-foreground whitespace-pre-wrap text-sm sm:text-base leading-relaxed">
              {currentTranscript || 'Warte auf Spracheingabe...'}
            </p>
          </div>
          <div className="mt-4 p-4 bg-warning/10 rounded-xl flex items-start gap-3">
            <Lightbulb size={18} className="text-warning flex-shrink-0 mt-0.5" />
            <p className="text-sm text-foreground">
              <strong>Tipp:</strong> Lass dieses Fenster im Hintergrund laufen während dein Meeting läuft. Die Transkription erfolgt automatisch.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
