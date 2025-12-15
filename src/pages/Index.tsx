import { useState } from "react";
import { MeetingBot } from "@/components/MeetingBot";
import { RecordingViewer } from "@/components/RecordingViewer";
import { Toaster } from "@/components/ui/toaster";
import { Mic } from "lucide-react";

const Index = () => {
  const [activeMeetingId, setActiveMeetingId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 rounded-full bg-primary/10">
              <Mic className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-2">
            AI Meeting Recorder
          </h1>
          <p className="text-muted-foreground text-lg">
            Lass einen Bot deine Meetings aufnehmen und transkribieren
          </p>
        </div>

        {/* Main Content */}
        <div className="flex flex-col items-center gap-8">
          <MeetingBot onMeetingCreated={setActiveMeetingId} />
          
          {activeMeetingId && (
            <RecordingViewer meetingId={activeMeetingId} />
          )}
        </div>
      </div>
      <Toaster />
    </div>
  );
};

export default Index;
