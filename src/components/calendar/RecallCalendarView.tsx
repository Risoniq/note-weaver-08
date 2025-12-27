import { useRecallCalendar, RecallMeeting } from '@/hooks/useRecallCalendar';
import { RecallCalendarConnection } from './RecallCalendarConnection';
import { RecallUpcomingMeetings } from './RecallUpcomingMeetings';
import { RecallRecordingPreferences } from './RecallRecordingPreferences';

interface RecallCalendarViewProps {
  onStartRecording?: (meeting: RecallMeeting) => void;
}

export const RecallCalendarView = ({ onStartRecording }: RecallCalendarViewProps) => {
  const {
    status,
    isLoading,
    error,
    meetings,
    googleConnected,
    microsoftConnected,
    preferences,
    connect,
    disconnect,
    fetchMeetings,
    updateMeetingRecording,
    updatePreferences,
  } = useRecallCalendar();

  const handleJoinMeeting = (meeting: RecallMeeting) => {
    if (meeting.meeting_url) {
      window.open(meeting.meeting_url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="space-y-6">
      <RecallCalendarConnection
        status={status}
        error={error}
        googleConnected={googleConnected}
        microsoftConnected={microsoftConnected}
        onConnectGoogle={() => connect('google')}
        onConnectMicrosoft={() => connect('microsoft')}
        onDisconnect={disconnect}
        onRefresh={fetchMeetings}
        isLoading={isLoading}
      />

      {status === 'connected' && (
        <>
          <RecallRecordingPreferences
            preferences={preferences}
            onUpdatePreferences={updatePreferences}
          />

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Anstehende Meetings (Automatische Aufnahme)
            </h2>
            <RecallUpcomingMeetings
              meetings={meetings}
              isLoading={isLoading}
              onToggleRecording={updateMeetingRecording}
              onJoinMeeting={handleJoinMeeting}
            />
          </div>
        </>
      )}

      {status === 'disconnected' && (
        <div className="bg-muted/50 rounded-xl p-8 text-center">
          <p className="text-muted-foreground mb-4">
            Verbinde deinen Kalender, um automatisch an allen Meetings mit einem Bot teilzunehmen.
          </p>
        </div>
      )}
    </div>
  );
};
