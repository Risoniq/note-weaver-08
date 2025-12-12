import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { useMeetingReminders } from '@/hooks/useMeetingReminders';
import { CalendarConnection } from './CalendarConnection';
import { UpcomingMeetings } from './UpcomingMeetings';
import { ReminderSettings } from './ReminderSettings';
import { CalendarEvent } from '@/types/calendar';

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

  const {
    requestNotificationPermission,
    notificationSupported,
    notificationPermission,
  } = useMeetingReminders(events, reminderSettings, onStartRecording);

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
