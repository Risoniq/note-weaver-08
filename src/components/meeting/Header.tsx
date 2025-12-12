import { Mic } from 'lucide-react';

export const Header = () => {
  return (
    <div className="mb-8 animate-slide-up">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-3 gradient-hero rounded-xl shadow-primary">
          <Mic className="h-7 w-7 text-primary-foreground" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
          Meeting Notetaker
        </h1>
      </div>
      <p className="text-muted-foreground text-lg ml-1">
        Live-Transkription für deine Online-Meetings
      </p>
    </div>
  );
};
