import { useMemo } from 'react';
import { parseTranscriptWithColors, createSpeakerColorMap, extractSpeakersInOrder, SPEAKER_COLORS } from '@/utils/speakerColors';

interface ColoredTranscriptProps {
  transcript: string;
  className?: string;
}

export const ColoredTranscript = ({ transcript, className = '' }: ColoredTranscriptProps) => {
  const parsedLines = useMemo(() => parseTranscriptWithColors(transcript), [transcript]);
  
  if (parsedLines.length === 0) {
    return (
      <p className="text-foreground whitespace-pre-wrap text-sm leading-relaxed">
        {transcript}
      </p>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {parsedLines.map((line, index) => (
        <div key={index} className="flex gap-3 animate-fade-in" style={{ animationDelay: `${Math.min(index * 20, 200)}ms` }}>
          <div 
            className="shrink-0 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap"
            style={{ 
              backgroundColor: line.color.bg,
              color: line.color.text,
              border: `1px solid ${line.color.border}`,
            }}
          >
            {line.speaker}
          </div>
          <p className="text-foreground text-sm leading-relaxed pt-0.5">
            {line.text}
          </p>
        </div>
      ))}
    </div>
  );
};

// Legende für Sprecherfarben
interface SpeakerLegendProps {
  transcript: string;
}

export const SpeakerLegend = ({ transcript }: SpeakerLegendProps) => {
  const speakers = useMemo(() => extractSpeakersInOrder(transcript), [transcript]);
  const colorMap = useMemo(() => createSpeakerColorMap(speakers), [speakers]);

  if (speakers.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {speakers.map((speaker) => {
        const color = colorMap.get(speaker) || SPEAKER_COLORS[0];
        return (
          <div 
            key={speaker}
            className="px-3 py-1 rounded-full text-xs font-medium"
            style={{ 
              backgroundColor: color.bg,
              color: color.text,
              border: `1px solid ${color.border}`,
            }}
          >
            {speaker}
          </div>
        );
      })}
    </div>
  );
};
