import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { RecordingViewer } from "@/components/RecordingViewer";
import { QuickMeetingJoin } from "@/components/calendar/QuickMeetingJoin";
import { AccountAnalyticsCard } from "@/components/dashboard/AccountAnalyticsCard";
import { TeamAnalyticsCard } from "@/components/dashboard/TeamAnalyticsCard";
import { AudioUploadCard } from "@/components/dashboard/AudioUploadCard";
import { Toaster } from "@/components/ui/toaster";
import { RefreshCw, AlertTriangle, ArrowRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/ui/glass-card";
import { QuotaProgressBar } from "@/components/quota/QuotaProgressBar";
import { QuotaExhaustedModal } from "@/components/quota/QuotaExhaustedModal";
import { useUserQuota } from "@/hooks/useUserQuota";
import { useTeamleadCheck } from "@/hooks/useTeamleadCheck";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAutoStartTour } from "@/hooks/useOnboardingTour";

const Index = () => {
  const [activeRecordingId, setActiveRecordingId] = useState<string | null>(null);
  const { quota, loading: quotaLoading } = useUserQuota();
  const { isTeamlead, teamName, leadTeams } = useTeamleadCheck();
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [showExhaustedModal, setShowExhaustedModal] = useState(false);

  // Auto-start onboarding tour for first-time users
  useAutoStartTour();

  // Modal anzeigen wenn Kontingent erschöpft
  useEffect(() => {
    if (quota?.is_exhausted) {
      setShowExhaustedModal(true);
    }
  }, [quota]);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Quota Progress Bar - ganz oben */}
        {quota && !quotaLoading && (
          <GlassCard>
            <QuotaProgressBar quota={quota} />
          </GlassCard>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground">
              Lass einen Bot deine Meetings aufnehmen und transkribieren
            </p>
          </div>
          
          {/* Toolbar */}
          <div className="flex items-center gap-3">
            <Button variant="glass" size="lg">
              <RefreshCw className="h-4 w-4 mr-2" />
              Aktualisieren
            </Button>
          </div>
        </div>

        {/* Quota Exhausted Warning Banner */}
        {quota?.is_exhausted && (
          <Alert className="border-destructive bg-destructive/10">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <AlertDescription>
              <strong>Kontingent erschöpft:</strong> Du kannst keine weiteren Meetings aufnehmen. 
              Deine bisherigen Aufnahmen stehen weiterhin zur Analyse bereit.
            </AlertDescription>
          </Alert>
        )}

        {/* Bot-Steuerung und Account-Analyse - nur wenn Kontingent verfügbar */}
        {!quota?.is_exhausted && (
          <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <GlassCard title="Bot zu Meeting senden">
                <QuickMeetingJoin onBotStarted={setActiveRecordingId} />
              </GlassCard>
              
              <GlassCard title="Audio/Video hochladen">
                <AudioUploadCard />
              </GlassCard>
              
              <GlassCard title={isTeamlead ? `Team-Analyse${leadTeams.length > 1 ? '' : ': ' + teamName}` : 'Account-Analyse'}>
                {isTeamlead ? (
                  <div className="space-y-2">
                    {leadTeams.length > 1 && (
                      <Select
                        value={selectedTeamId || leadTeams[0]?.id || ''}
                        onValueChange={setSelectedTeamId}
                      >
                        <SelectTrigger className="w-full h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {leadTeams.map((t) => (
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <TeamAnalyticsCard teamId={selectedTeamId || leadTeams[0]?.id || null} />
                  </div>
                ) : (
                  <AccountAnalyticsCard />
                )}
              </GlassCard>
            </div>

            {/* Animated Link to Recordings */}
            <Link 
              to="/recordings" 
              className="group flex items-center justify-center gap-2 py-4 text-lg font-medium text-primary transition-all duration-300 hover:gap-4"
            >
              <span className="animate-fade-in">Zu den Meeting-Analysen</span>
              <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-2" />
            </Link>
            
            {/* Active Recording Status */}
            {activeRecordingId && (
              <GlassCard title="Aktive Aufnahme">
                <RecordingViewer recordingId={activeRecordingId} />
              </GlassCard>
            )}
          </div>
        )}

        {/* Active Recording Status - auch bei erschöpftem Kontingent anzeigen wenn noch aktiv */}
        {quota?.is_exhausted && activeRecordingId && (
          <GlassCard title="Aktive Aufnahme">
            <RecordingViewer recordingId={activeRecordingId} />
          </GlassCard>
        )}

        {/* Modal für erschöpftes Kontingent */}
        <QuotaExhaustedModal 
          open={showExhaustedModal} 
          onClose={() => setShowExhaustedModal(false)} 
        />
      </div>
      <Toaster />
    </AppLayout>
  );
};

export default Index;
