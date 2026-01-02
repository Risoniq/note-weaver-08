import { useMemo } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { format, isSameDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { RecallMeeting } from '@/hooks/useRecallCalendarMeetings';
import { Badge } from '@/components/ui/badge';

interface CalendarMonthViewProps {
  meetings: RecallMeeting[];
  selectedDate: Date | undefined;
  onDateSelect: (date: Date | undefined) => void;
}

export const CalendarMonthView = ({ 
  meetings, 
  selectedDate, 
  onDateSelect 
}: CalendarMonthViewProps) => {
  // Group meetings by date
  const meetingsByDate = useMemo(() => {
    const map = new Map<string, RecallMeeting[]>();
    meetings.forEach(meeting => {
      const dateKey = format(new Date(meeting.start_time), 'yyyy-MM-dd');
      const existing = map.get(dateKey) || [];
      map.set(dateKey, [...existing, meeting]);
    });
    return map;
  }, [meetings]);

  // Get dates that have meetings
  const datesWithMeetings = useMemo(() => {
    return Array.from(meetingsByDate.keys()).map(dateStr => new Date(dateStr));
  }, [meetingsByDate]);

  // Count meetings for selected date
  const selectedDateMeetings = useMemo(() => {
    if (!selectedDate) return [];
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    return meetingsByDate.get(dateKey) || [];
  }, [selectedDate, meetingsByDate]);

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Kalender</h3>
        {selectedDate && selectedDateMeetings.length > 0 && (
          <Badge variant="secondary">
            {selectedDateMeetings.length} Meeting{selectedDateMeetings.length !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>
      
      <Calendar
        mode="single"
        selected={selectedDate}
        onSelect={onDateSelect}
        locale={de}
        modifiers={{
          hasMeeting: datesWithMeetings
        }}
        modifiersClassNames={{
          hasMeeting: 'after:absolute after:bottom-0.5 after:left-1/2 after:-translate-x-1/2 after:w-1.5 after:h-1.5 after:rounded-full after:bg-primary'
        }}
        className="rounded-md"
      />
      
      {selectedDate && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-sm text-muted-foreground">
            {format(selectedDate, 'EEEE, d. MMMM yyyy', { locale: de })}
          </p>
          {selectedDateMeetings.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-2">
              Keine Meetings an diesem Tag
            </p>
          ) : (
            <p className="text-sm text-foreground mt-2">
              {selectedDateMeetings.length} Meeting{selectedDateMeetings.length !== 1 ? 's' : ''} geplant
            </p>
          )}
        </div>
      )}
    </div>
  );
};
