import { useEffect } from 'react';
import { useGoogleRecallCalendar } from '@/hooks/useGoogleRecallCalendar';
import { useMicrosoftRecallCalendar } from '@/hooks/useMicrosoftRecallCalendar';
import { useRecallCalendarMeetings, RecallMeeting } from '@/hooks/useRecallCalendarMeetings';
import { RecallCalendarConnection } from './RecallCalendarConnection';
import { RecallUpcomingMeetings } from './RecallUpcomingMeetings';
import { RecallRecordingPreferences } from './RecallRecordingPreferences';

interface RecallCalendarViewProps {
  onStartRecording?: (meeting: RecallMeeting) => void;
}

export const RecallCalendarView = ({ onStartRecording }: RecallCalendarViewProps) => {
  const google = useGoogleRecallCalendar();
  const microsoft = useMicrosoftRecallCalendar();
  const meetings = useRecallCalendarMeetings();

  // Fetch meetings when either calendar is connected
  useEffect(() => {
    if (google.connected || microsoft.connected) {
      meetings.fetchMeetings();
    }
  }, [google.connected, microsoft.connected]);

  const isConnected = google.connected || microsoft.connected;

  const handleJoinMeeting = (meeting: RecallMeeting) => {
    if (meeting.meeting_url) {
      window.open(meeting.meeting_url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="space-y-6">
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
        onRefreshMeetings={meetings.fetchMeetings}
      />

      {isConnected && (
        <>
          <RecallRecordingPreferences
            preferences={meetings.preferences}
            onUpdatePreferences={meetings.updatePreferences}
            onInitPreferences={meetings.initPreferences}
          />

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Anstehende Meetings (Automatische Aufnahme)
            </h2>
            <RecallUpcomingMeetings
              meetings={meetings.meetings}
              isLoading={meetings.isLoading}
              meetingsError={meetings.meetingsError}
              onToggleRecording={meetings.updateMeetingRecording}
              onJoinMeeting={handleJoinMeeting}
              onRetry={meetings.fetchMeetings}
            />
          </div>
        </>
      )}

      {!isConnected && google.status === 'disconnected' && microsoft.status === 'disconnected' && (
        <div className="bg-muted/50 rounded-xl p-8 text-center">
          <p className="text-muted-foreground mb-4">
            Verbinde deinen Kalender, um automatisch an allen Meetings mit einem Bot teilzunehmen.
          </p>
        </div>
      )}
    </div>
  );
};
