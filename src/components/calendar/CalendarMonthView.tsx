import { useMemo } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { format, parse } from 'date-fns';
import { de } from 'date-fns/locale';
import { RecallMeeting } from '@/hooks/useRecallCalendarMeetings';
import { Badge } from '@/components/ui/badge';
import { Video, VideoOff } from 'lucide-react';

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
  // Group meetings by date and track which have links
  const { meetingsByDate, datesWithLink, datesWithoutLink } = useMemo(() => {
    const map = new Map<string, RecallMeeting[]>();
    const withLink = new Set<string>();
    const withoutLink = new Set<string>();
    
    meetings.forEach(meeting => {
      const dateKey = format(new Date(meeting.start_time), 'yyyy-MM-dd');
      const existing = map.get(dateKey) || [];
      map.set(dateKey, [...existing, meeting]);
      
      // Track if this date has meetings with/without links
      if (meeting.meeting_url) {
        withLink.add(dateKey);
      } else {
        withoutLink.add(dateKey);
      }
    });
    
    return {
      meetingsByDate: map,
      datesWithLink: Array.from(withLink).map(dateStr => parse(dateStr, 'yyyy-MM-dd', new Date())),
      datesWithoutLink: Array.from(withoutLink).map(dateStr => parse(dateStr, 'yyyy-MM-dd', new Date())),
    };
  }, [meetings]);

  // Count meetings for selected date
  const selectedDateMeetings = useMemo(() => {
    if (!selectedDate) return [];
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    return meetingsByDate.get(dateKey) || [];
  }, [selectedDate, meetingsByDate]);

  // Count meetings with/without links for selected date
  const { withLinkCount, withoutLinkCount } = useMemo(() => {
    const withLink = selectedDateMeetings.filter(m => m.meeting_url).length;
    const withoutLink = selectedDateMeetings.filter(m => !m.meeting_url).length;
    return { withLinkCount: withLink, withoutLinkCount: withoutLink };
  }, [selectedDateMeetings]);

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-foreground">Kalender</h3>
        {selectedDate && selectedDateMeetings.length > 0 && (
          <Badge variant="secondary">
            {selectedDateMeetings.length} Termin{selectedDateMeetings.length !== 1 ? 'e' : ''}
          </Badge>
        )}
      </div>
      
      {/* Legend */}
      <div className="flex items-center gap-4 mb-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-primary" />
          <span>Bot kann beitreten</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span>Kein Link</span>
        </div>
      </div>
      
      <Calendar
        mode="single"
        selected={selectedDate}
        onSelect={onDateSelect}
        locale={de}
        modifiers={{
          hasLinkMeeting: datesWithLink,
          hasNoLinkMeeting: datesWithoutLink,
        }}
        modifiersClassNames={{
          hasLinkMeeting: 'after:absolute after:bottom-0.5 after:left-[calc(50%-4px)] after:w-1.5 after:h-1.5 after:rounded-full after:bg-primary',
          hasNoLinkMeeting: 'before:absolute before:bottom-0.5 before:left-[calc(50%+2px)] before:w-1.5 before:h-1.5 before:rounded-full before:bg-amber-500',
        }}
        className="rounded-md w-full [&_.rdp-months]:w-full [&_.rdp-month]:w-full [&_.rdp-table]:w-full"
      />
      
      {selectedDate && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-sm text-muted-foreground">
            {format(selectedDate, 'EEEE, d. MMMM yyyy', { locale: de })}
          </p>
          {selectedDateMeetings.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-2">
              Keine Termine an diesem Tag
            </p>
          ) : (
            <div className="mt-2 space-y-1">
              {withLinkCount > 0 && (
                <p className="text-sm text-foreground flex items-center gap-1.5">
                  <Video className="h-3.5 w-3.5 text-primary" />
                  {withLinkCount} mit Meeting-Link
                </p>
              )}
              {withoutLinkCount > 0 && (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <VideoOff className="h-3.5 w-3.5 text-amber-500" />
                  {withoutLinkCount} ohne Link
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
