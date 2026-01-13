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
    <div className="bg-card rounded-lg border border-border p-2 max-w-[280px]">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-foreground">Kalender</h3>
        {selectedDate && selectedDateMeetings.length > 0 && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {selectedDateMeetings.length}
          </Badge>
        )}
      </div>
      
      {/* Legend */}
      <div className="flex items-center gap-2 mb-1.5 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          <span>Mit Link</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          <span>Ohne</span>
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
          hasLinkMeeting: 'after:absolute after:bottom-0 after:left-[calc(50%-3px)] after:w-1 after:h-1 after:rounded-full after:bg-primary',
          hasNoLinkMeeting: 'before:absolute before:bottom-0 before:left-[calc(50%+1px)] before:w-1 before:h-1 before:rounded-full before:bg-amber-500',
        }}
        className="rounded-md text-xs [&_.rdp-months]:w-full [&_.rdp-month]:w-full [&_.rdp-table]:w-full [&_.rdp-head_th]:text-[10px] [&_.rdp-head_th]:p-1 [&_.rdp-cell]:p-0 [&_.rdp-day]:h-6 [&_.rdp-day]:w-6 [&_.rdp-day]:text-[11px] [&_.rdp-caption]:text-xs [&_.rdp-nav_button]:h-5 [&_.rdp-nav_button]:w-5"
      />
      
      {selectedDate && (
        <div className="mt-2 pt-2 border-t border-border">
          <p className="text-[10px] text-muted-foreground">
            {format(selectedDate, 'd. MMM yyyy', { locale: de })}
          </p>
          {selectedDateMeetings.length === 0 ? (
            <p className="text-[10px] text-muted-foreground mt-1">
              Keine Termine
            </p>
          ) : (
            <div className="mt-1 space-y-0.5">
              {withLinkCount > 0 && (
                <p className="text-[10px] text-foreground flex items-center gap-1">
                  <Video className="h-2.5 w-2.5 text-primary" />
                  {withLinkCount} mit Link
                </p>
              )}
              {withoutLinkCount > 0 && (
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <VideoOff className="h-2.5 w-2.5 text-amber-500" />
                  {withoutLinkCount} ohne
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
