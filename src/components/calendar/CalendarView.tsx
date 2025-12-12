import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { useMeetingReminders } from '@/hooks/useMeetingReminders';
import { useMeetingBotWebhook } from '@/hooks/useMeetingBotWebhook';
import { CalendarConnection } from './CalendarConnection';
import { UpcomingMeetings } from './UpcomingMeetings';
import { ReminderSettings } from './ReminderSettings';
import { CalendarEvent } from '@/types/calendar';
import { Button } from '@/components/ui/button';
import { FlaskConical } from 'lucide-react';

interface CalendarViewProps {
  onStartRecording?: (event: CalendarEvent) => void;
}

export const CalendarView = ({ onStartRecording }: CalendarViewProps) => {
  const {
    status,
    events,
    isLoading,
    error,
    connect,
    disconnect,
    fetchEvents,
    reminderSettings,
    updateReminderSettings,
  } = useGoogleCalendar();

  const { triggerBotWebhook } = useMeetingBotWebhook();

  const handleMeetingStart = (event: CalendarEvent) => {
    // Trigger webhook to notify bot service
    triggerBotWebhook(event);
    
    // Also call optional recording callback
    if (onStartRecording) {
      onStartRecording(event);
    }
  };

  const handleTestWebhook = async () => {
    const testEvent: CalendarEvent = {
      id: 'test-' + Date.now(),
      summary: 'Test Meeting ' + new Date().toLocaleTimeString('de-DE'),
      description: 'Test webhook call',
      location: '',
      start: new Date().toISOString(),
      end: new Date(Date.now() + 3600000).toISOString(),
      meetingUrl: 'https://meet.google.com/test-xyz-123',
      hangoutLink: 'https://meet.google.com/test-xyz-123',
      attendees: [{ email: 'test@example.com', displayName: 'Test User', responseStatus: 'accepted' }]
    };
    await triggerBotWebhook(testEvent);
  };

  const {
    requestNotificationPermission,
    notificationSupported,
    notificationPermission,
  } = useMeetingReminders(events, reminderSettings, handleMeetingStart);

  return (
    <div className="space-y-6">
      <CalendarConnection
        status={status}
        error={error}
        onConnect={connect}
        onDisconnect={disconnect}
        onRefresh={() => fetchEvents()}
        isLoading={isLoading}
      />

      {status === 'connected' && (
        <>
          <ReminderSettings
            enabled={reminderSettings.enabled}
            minutesBefore={reminderSettings.minutesBefore}
            onEnabledChange={(enabled) => updateReminderSettings({ enabled })}
            onMinutesChange={(minutesBefore) => updateReminderSettings({ minutesBefore })}
            notificationSupported={notificationSupported}
            notificationPermission={notificationPermission}
            onRequestPermission={requestNotificationPermission}
          />

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestWebhook}
              className="gap-2"
            >
              <FlaskConical className="h-4 w-4" />
              Webhook testen
            </Button>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Anstehende Meetings
            </h2>
            <UpcomingMeetings
              events={events}
              isLoading={isLoading}
              onStartRecording={onStartRecording}
            />
          </div>
        </>
      )}

      {status === 'disconnected' && (
        <div className="bg-muted/50 rounded-xl p-8 text-center">
          <p className="text-muted-foreground mb-4">
            Verbinde deinen Google Kalender, um anstehende Meetings zu sehen und Erinnerungen zu erhalten.
          </p>
        </div>
      )}
    </div>
  );
};
