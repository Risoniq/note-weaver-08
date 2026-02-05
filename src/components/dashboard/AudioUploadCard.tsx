import { useState, useRef } from 'react';
import { Upload, FileAudio, Loader2, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AudioUploadCardProps {
  onUploadComplete?: (recordingId: string) => void;
}

type UploadStatus = 'idle' | 'uploading' | 'transcribing' | 'success' | 'error';

export function AudioUploadCard({ onUploadComplete }: AudioUploadCardProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const acceptedFormats = '.mp3,.m4a,.wav,.mp4,.webm,.ogg,.flac';
  const maxSizeMB = 100;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file size
    if (selectedFile.size > maxSizeMB * 1024 * 1024) {
      toast.error(`Datei zu groß. Maximum: ${maxSizeMB}MB`);
      return;
    }

    setFile(selectedFile);
    setTitle(selectedFile.name.replace(/\.[^/.]+$/, ''));
    setStatus('idle');
    setErrorMessage('');
  };

  const handleUpload = async () => {
    if (!file) return;

    setStatus('uploading');
    setProgress(10);
    setErrorMessage('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Nicht angemeldet');
      }

      setProgress(20);

      const formData = new FormData();
      formData.append('audio', file);
      formData.append('title', title || file.name);

      setStatus('transcribing');
      setProgress(40);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-audio`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: formData,
        }
      );

      setProgress(80);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Transkription fehlgeschlagen');
      }

      const result = await response.json();
      setProgress(100);
      setStatus('success');

      toast.success('Audio erfolgreich transkribiert!', {
        description: `${result.wordCount} Wörter, ${Math.floor(result.duration / 60)}:${String(result.duration % 60).padStart(2, '0')} Minuten`,
      });

      if (onUploadComplete) {
        onUploadComplete(result.recordingId);
      }

      // Reset after success
      setTimeout(() => {
        setFile(null);
        setTitle('');
        setStatus('idle');
        setProgress(0);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }, 2000);

    } catch (error) {
      console.error('Upload error:', error);
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Unbekannter Fehler');
      toast.error('Upload fehlgeschlagen', {
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
      });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      const ext = droppedFile.name.split('.').pop()?.toLowerCase();
      if (acceptedFormats.includes(`.${ext}`)) {
        setFile(droppedFile);
        setTitle(droppedFile.name.replace(/\.[^/.]+$/, ''));
        setStatus('idle');
        setErrorMessage('');
      } else {
        toast.error('Ungültiges Dateiformat');
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const isProcessing = status === 'uploading' || status === 'transcribing';

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className={`
          relative border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer
          ${file ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
          ${isProcessing ? 'pointer-events-none opacity-60' : ''}
        `}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedFormats}
          onChange={handleFileSelect}
          className="hidden"
          disabled={isProcessing}
        />

        {file ? (
          <div className="flex items-center justify-center gap-3">
            <FileAudio className="h-8 w-8 text-primary" />
            <div className="text-left">
              <p className="font-medium text-foreground truncate max-w-[200px]">{file.name}</p>
              <p className="text-sm text-muted-foreground">
                {(file.size / (1024 * 1024)).toFixed(1)} MB
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Audio-/Videodatei hierher ziehen oder klicken
            </p>
            <p className="text-xs text-muted-foreground/70">
              MP3, M4A, WAV, MP4, WebM • Max {maxSizeMB}MB
            </p>
          </div>
        )}
      </div>

      {/* Title Input */}
      {file && (
        <Input
          placeholder="Titel der Aufnahme"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isProcessing}
        />
      )}

      {/* Progress */}
      {isProcessing && (
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-muted-foreground text-center flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {status === 'uploading' ? 'Wird hochgeladen...' : 'Wird transkribiert...'}
          </p>
        </div>
      )}

      {/* Success */}
      {status === 'success' && (
        <div className="flex items-center justify-center gap-2 text-primary">
          <Check className="h-5 w-5" />
          <span className="text-sm font-medium">Erfolgreich transkribiert!</span>
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div className="flex items-center justify-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <span className="text-sm">{errorMessage}</span>
        </div>
      )}

      {/* Upload Button */}
      {file && status !== 'success' && (
        <Button
          onClick={handleUpload}
          disabled={isProcessing}
          className="w-full"
          size="lg"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Verarbeite...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Transkribieren
            </>
          )}
        </Button>
      )}
    </div>
  );
}
