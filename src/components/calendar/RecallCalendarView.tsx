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
    meetingsError,
    meetings,
    googleConnected,
    microsoftConnected,
    preferences,
    needsRepair,
    recallUserId,
    pendingOauthUrl,
    pendingOauthProvider,
    debugInfo,
    connect,
    disconnectGoogle,
    disconnectMicrosoft,
    checkStatus,
    fetchMeetings,
    updateMeetingRecording,
    updatePreferences,
    repairConnection,
    debugConnections,
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
        pendingOauthUrl={pendingOauthUrl}
        pendingOauthProvider={pendingOauthProvider}
        onConnectGoogle={() => connect('google')}
        onConnectMicrosoft={() => connect('microsoft')}
        onDisconnectGoogle={disconnectGoogle}
        onDisconnectMicrosoft={disconnectMicrosoft}
        onRefresh={fetchMeetings}
        onCheckStatus={checkStatus}
        onRepair={repairConnection}
        onDebugConnections={debugConnections}
        isLoading={isLoading}
        needsRepair={needsRepair}
        recallUserId={recallUserId}
        debugInfo={debugInfo}
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
              meetingsError={meetingsError}
              onToggleRecording={updateMeetingRecording}
              onJoinMeeting={handleJoinMeeting}
              onRetry={fetchMeetings}
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
