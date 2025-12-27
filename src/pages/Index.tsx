import { useState } from "react";
import { Link } from "react-router-dom";
import { MeetingBot } from "@/components/MeetingBot";
import { RecordingViewer } from "@/components/RecordingViewer";
import { RecordingsList } from "@/components/recordings/RecordingsList";
import { RecentActivityList } from "@/components/recordings/RecentActivityList";
import { RecallCalendarView } from "@/components/calendar/RecallCalendarView";
import { Toaster } from "@/components/ui/toaster";
import { Mic, Settings, Calendar } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Index = () => {
  const [activeRecordingId, setActiveRecordingId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 rounded-full bg-primary/10">
              <Mic className="h-8 w-8 text-primary" />
            </div>
            <Link to="/settings">
              <div className="p-3 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors cursor-pointer">
                <Settings className="h-8 w-8 text-primary" />
              </div>
            </Link>
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-2">
            AI Meeting Recorder
          </h1>
          <p className="text-muted-foreground text-lg">
            Lass einen Bot deine Meetings aufnehmen und transkribieren
          </p>
        </div>

        {/* Main Content */}
        <div className="flex flex-col items-center gap-8 max-w-5xl mx-auto">
          <Tabs defaultValue="calendar" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="calendar" className="gap-2">
                <Calendar size={16} />
                Kalender-Automatik
              </TabsTrigger>
              <TabsTrigger value="manual" className="gap-2">
                <Mic size={16} />
                Manuell
              </TabsTrigger>
            </TabsList>

            <TabsContent value="calendar">
              <RecallCalendarView />
            </TabsContent>

            <TabsContent value="manual">
              {/* Meeting Bot Input */}
              <MeetingBot onRecordingCreated={setActiveRecordingId} />
              
              {/* Active Recording Status */}
              {activeRecordingId && (
                <div className="mt-6">
                  <RecordingViewer recordingId={activeRecordingId} />
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Recent Activity List */}
          <RecentActivityList />

          {/* Recordings Dashboard */}
          <RecordingsList />
        </div>
      </div>
      <Toaster />
    </div>
  );
};

export default Index;
