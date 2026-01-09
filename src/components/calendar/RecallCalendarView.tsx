import { useEffect, useState, useMemo } from 'react';
import { useGoogleRecallCalendar } from '@/hooks/useGoogleRecallCalendar';
import { useMicrosoftRecallCalendar } from '@/hooks/useMicrosoftRecallCalendar';
import { useRecallCalendarMeetings, RecallMeeting } from '@/hooks/useRecallCalendarMeetings';
import { RecallUpcomingMeetings } from './RecallUpcomingMeetings';

import { CalendarMonthView } from './CalendarMonthView';
import { isSameDay } from 'date-fns';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { RefreshCw, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface RecallCalendarViewProps {
  onStartRecording?: (meeting: RecallMeeting) => void;
}

export const RecallCalendarView = ({ onStartRecording }: RecallCalendarViewProps) => {
  const google = useGoogleRecallCalendar();
  const microsoft = useMicrosoftRecallCalendar();
  const meetings = useRecallCalendarMeetings();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  // Fetch meetings when either calendar is connected
  useEffect(() => {
    if (google.connected || microsoft.connected) {
      meetings.fetchMeetings();
    }
  }, [google.connected, microsoft.connected]);

  const isConnected = google.connected || microsoft.connected;

  // Filter meetings for selected date or show all if no date selected
  const filteredMeetings = useMemo(() => {
    if (!selectedDate) return meetings.meetings;
    return meetings.meetings.filter(m => 
      isSameDay(new Date(m.start_time), selectedDate)
    );
  }, [selectedDate, meetings.meetings]);

  const handleJoinMeeting = (meeting: RecallMeeting) => {
    if (meeting.meeting_url) {
      window.open(meeting.meeting_url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    // Toggle selection if same date clicked
    if (date && selectedDate && isSameDay(date, selectedDate)) {
      setSelectedDate(undefined);
    } else {
      setSelectedDate(date);
    }
  };

  return (
    <div className="space-y-6">

      {isConnected && (
        <>

          {/* Auto-refresh toggle */}
          <div className="flex items-center justify-between bg-card rounded-lg border border-border p-4">
            <div className="flex items-center gap-2">
              <RefreshCw className={`h-4 w-4 ${meetings.autoRefreshEnabled ? 'text-primary animate-spin' : 'text-muted-foreground'}`} style={{ animationDuration: '3s' }} />
              <Label htmlFor="auto-refresh" className="text-sm font-medium">
                Auto-Refresh (alle 15 Sek.)
              </Label>
            </div>
            <Switch
              id="auto-refresh"
              checked={meetings.autoRefreshEnabled}
              onCheckedChange={meetings.setAutoRefreshEnabled}
            />
          </div>

          {/* Calendar view - full width */}
          <CalendarMonthView
            meetings={meetings.meetings}
            selectedDate={selectedDate}
            onDateSelect={handleDateSelect}
          />

          {/* Meetings list - below calendar */}
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">
              {selectedDate 
                ? `Meetings am ${selectedDate.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })}`
                : 'Alle anstehenden Meetings'
              }
            </h2>
            <RecallUpcomingMeetings
              meetings={filteredMeetings}
              isLoading={meetings.isLoading}
              meetingsError={meetings.meetingsError}
              onToggleRecording={meetings.updateMeetingRecording}
              onJoinMeeting={handleJoinMeeting}
              onRetry={meetings.fetchMeetings}
              onBotStarted={meetings.fetchMeetings}
              onRefreshCalendar={meetings.refreshCalendar}
              isRefreshingCalendar={meetings.isRefreshingCalendar}
            />
          </div>
        </>
      )}

      {!isConnected && google.status === 'disconnected' && microsoft.status === 'disconnected' && (
        <div className="bg-muted/50 rounded-xl p-8 text-center">
          <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">
            Verbinde deinen Kalender in den Einstellungen, um automatisch an allen Meetings mit einem Bot teilzunehmen.
          </p>
          <Link to="/settings">
            <Button>
              <Settings className="h-4 w-4 mr-2" />
              Zu den Einstellungen
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
};
