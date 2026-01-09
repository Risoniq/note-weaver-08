import { useState } from "react";
import { MeetingBot } from "@/components/MeetingBot";
import { RecordingViewer } from "@/components/RecordingViewer";
import { RecordingsList } from "@/components/recordings/RecordingsList";
import { RecentActivityList } from "@/components/recordings/RecentActivityList";
import { RecallCalendarView } from "@/components/calendar/RecallCalendarView";
import { QuickMeetingJoin } from "@/components/calendar/QuickMeetingJoin";
import { Toaster } from "@/components/ui/toaster";
import { Calendar, Mic, RefreshCw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/ui/glass-card";

const Index = () => {
  const [activeRecordingId, setActiveRecordingId] = useState<string | null>(null);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground">
              Lass einen Bot deine Meetings aufnehmen und transkribieren
            </p>
          </div>
          
          {/* Toolbar - wie im SwiftUI LovableButton */}
          <div className="flex items-center gap-3">
            <Button variant="glass" size="lg">
              <RefreshCw className="h-4 w-4 mr-2" />
              Aktualisieren
            </Button>
          </div>
        </div>

        {/* Main Content with Tabs */}
        <Tabs defaultValue="calendar" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6 bg-white/50 dark:bg-slate-800/50 backdrop-blur-md rounded-xl p-1">
            <TabsTrigger 
              value="calendar" 
              className="gap-2 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm"
            >
              <Calendar size={16} />
              Kalender-Automatik
            </TabsTrigger>
            <TabsTrigger 
              value="manual" 
              className="gap-2 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm"
            >
              <Mic size={16} />
              Manuell
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calendar">
            <GlassCard>
              <RecallCalendarView />
            </GlassCard>
          </TabsContent>

          <TabsContent value="manual" className="space-y-6">
            {/* Quick Meeting Join */}
            <GlassCard title="Schnell-Beitritt">
              <QuickMeetingJoin />
            </GlassCard>
            
            {/* Meeting Bot Input */}
            <GlassCard title="Manueller Bot">
              <MeetingBot onRecordingCreated={setActiveRecordingId} />
            </GlassCard>
            
            {/* Active Recording Status */}
            {activeRecordingId && (
              <GlassCard title="Aktive Aufnahme">
                <RecordingViewer recordingId={activeRecordingId} />
              </GlassCard>
            )}
          </TabsContent>
        </Tabs>

        {/* Dashboard Grid - wie SwiftUI Grid mit GridRow */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Recent Activity */}
          <GlassCard title="Letzte Aktivitäten">
            <RecentActivityList />
          </GlassCard>
          
          {/* Recordings */}
          <GlassCard title="Aufnahmen">
            <RecordingsList />
          </GlassCard>
        </div>
      </div>
      <Toaster />
    </AppLayout>
  );
};

export default Index;
