import { ArrowLeft, Calendar as CalendarIcon, Settings2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useRecallCalendarMeetings } from "@/hooks/useRecallCalendarMeetings";
import { useGoogleRecallCalendar } from "@/hooks/useGoogleRecallCalendar";
import { useMicrosoftRecallCalendar } from "@/hooks/useMicrosoftRecallCalendar";
import { RecallCalendarConnection } from "@/components/calendar/RecallCalendarConnection";
import { AppLayout } from "@/components/layout/AppLayout";

const Calendar = () => {
  const { preferences, updatePreferences, fetchMeetings } = useRecallCalendarMeetings();
  const google = useGoogleRecallCalendar();
  const microsoft = useMicrosoftRecallCalendar();

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <CalendarIcon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Kalender</h1>
            <p className="text-muted-foreground">Verbinde deine Kalender für automatische Aufnahmen</p>
          </div>
        </div>

        {/* Calendar Connection Cards */}
        <Card data-tour="calendar-connection">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-primary" />
              <CardTitle>Kalender-Verbindungen</CardTitle>
            </div>
            <CardDescription>Verbinde Google oder Microsoft Kalender, damit der Bot automatisch deinen Meetings beitritt</CardDescription>
          </CardHeader>
          <CardContent>
            <RecallCalendarConnection
              // Google props
              googleStatus={google.status}
              googleError={google.error}
              googleConnected={google.connected}
              googlePendingOauthUrl={google.pendingOauthUrl}
              googleIsLoading={google.isLoading}
              onConnectGoogle={google.connect}
              onDisconnectGoogle={google.disconnect}
              onCheckGoogleStatus={google.checkStatus}
              // Microsoft props
              microsoftStatus={microsoft.status}
              microsoftError={microsoft.error}
              microsoftConnected={microsoft.connected}
              microsoftPendingOauthUrl={microsoft.pendingOauthUrl}
              microsoftIsLoading={microsoft.isLoading}
              onConnectMicrosoft={microsoft.connect}
              onDisconnectMicrosoft={microsoft.disconnect}
              onCheckMicrosoftStatus={microsoft.checkStatus}
              // Shared
              onRefreshMeetings={fetchMeetings}
            />
          </CardContent>
        </Card>

        {/* Recording Preferences */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" />
              <CardTitle>Aufnahme-Einstellungen</CardTitle>
            </div>
            <CardDescription>Konfiguriere, welche Meetings automatisch aufgezeichnet werden sollen</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between" data-tour="auto-record">
              <div className="space-y-0.5">
                <Label>Automatische Aufnahme</Label>
                <p className="text-sm text-muted-foreground">Bot tritt automatisch allen Meetings bei</p>
              </div>
              <Switch
                checked={preferences.auto_record}
                onCheckedChange={(checked) => updatePreferences({ auto_record: checked })}
              />
            </div>
            <Separator />
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Alle Meetings aufnehmen</Label>
                <p className="text-sm text-muted-foreground">Auch Meetings, zu denen du eingeladen wurdest</p>
              </div>
              <Switch
                checked={preferences.record_all}
                onCheckedChange={(checked) => updatePreferences({ record_all: checked })}
              />
            </div>
            <Separator />
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Nur eigene Meetings</Label>
                <p className="text-sm text-muted-foreground">Nur Meetings aufnehmen, die du organisiert hast</p>
              </div>
              <Switch
                checked={preferences.record_only_owned}
                onCheckedChange={(checked) => updatePreferences({ record_only_owned: checked })}
              />
            </div>
            <Separator />
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Externe Meetings aufnehmen</Label>
                <p className="text-sm text-muted-foreground">Meetings mit externen Teilnehmern aufnehmen</p>
              </div>
              <Switch
                checked={preferences.record_external}
                onCheckedChange={(checked) => updatePreferences({ record_external: checked })}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Calendar;
