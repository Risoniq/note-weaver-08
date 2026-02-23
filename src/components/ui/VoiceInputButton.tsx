import { useState, useEffect, useCallback } from "react";
import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  className?: string;
}

export const VoiceInputButton = ({
  onTranscript,
  disabled = false,
  className,
}: VoiceInputButtonProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const { isSupported, error, startRecognition, stopRecognition, setOnResult } = useSpeechRecognition();
  const { toast } = useToast();

  // Auto-stop after 30 seconds
  useEffect(() => {
    if (!isRecording) return;
    
    const timeout = setTimeout(() => {
      handleStop();
      toast({
        title: "Aufnahme beendet",
        description: "Maximale Aufnahmedauer von 30 Sekunden erreicht.",
      });
    }, 30000);

    return () => clearTimeout(timeout);
  }, [isRecording]);

  // Show error toast
  useEffect(() => {
    if (error) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: error,
      });
      setIsRecording(false);
    }
  }, [error, toast]);

  // Set up transcript callback
  useEffect(() => {
    setOnResult((transcript: string) => {
      if (transcript.trim()) {
        onTranscript(transcript.trim());
      }
    });
  }, [onTranscript, setOnResult]);

  const handleStart = useCallback(() => {
    setIsRecording(true);
    startRecognition();
  }, [startRecognition]);

  const handleStop = useCallback(() => {
    setIsRecording(false);
    stopRecognition();
  }, [stopRecognition]);

  const handleClick = () => {
    if (isRecording) {
      handleStop();
    } else {
      handleStart();
    }
  };

  // Show disabled button with tooltip if not supported
  if (!isSupported) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0}>
              <Button
                type="button"
                size="icon"
                variant="outline"
                disabled
                className={cn("opacity-50 cursor-not-allowed", className)}
              >
                <Mic className="h-4 w-4" />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>Spracheingabe wird nur in Chrome und Edge unterstützt</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Button
      type="button"
      size="icon"
      variant={isRecording ? "destructive" : "outline"}
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        "relative transition-all",
        isRecording && "animate-pulse",
        className
      )}
      title={isRecording ? "Aufnahme stoppen" : "Spracheingabe starten"}
    >
      {isRecording ? (
        <>
          <MicOff className="h-4 w-4" />
          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-destructive animate-ping" />
        </>
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </Button>
  );
};
