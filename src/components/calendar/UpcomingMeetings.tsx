import { CalendarEvent } from '@/types/calendar';
import { Video, Clock, Users, ExternalLink, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, formatDistanceToNow, isToday, isTomorrow, differenceInMinutes } from 'date-fns';
import { de } from 'date-fns/locale';

interface UpcomingMeetingsProps {
  events: CalendarEvent[];
  isLoading: boolean;
  onStartRecording?: (event: CalendarEvent) => void;
}

export const UpcomingMeetings = ({ events, isLoading, onStartRecording }: UpcomingMeetingsProps) => {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse">
            <div className="h-5 bg-muted rounded w-3/4 mb-2" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-center">
        <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
          <Video size={24} className="text-muted-foreground" />
        </div>
        <h3 className="font-medium text-foreground mb-1">Keine anstehenden Meetings</h3>
        <p className="text-sm text-muted-foreground">
          Deine nächsten Termine erscheinen hier
        </p>
      </div>
    );
  }

  const getDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return 'Heute';
    if (isTomorrow(date)) return 'Morgen';
    return format(date, 'EEEE, d. MMMM', { locale: de });
  };

  const getTimeUntil = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const minutes = differenceInMinutes(date, now);
    
    if (minutes < 0) return 'Läuft gerade';
    if (minutes < 1) return 'Jetzt';
    if (minutes < 60) return `in ${minutes} Min.`;
    return formatDistanceToNow(date, { locale: de, addSuffix: true });
  };

  const isHappeningSoon = (dateStr: string) => {
    const minutes = differenceInMinutes(new Date(dateStr), new Date());
    return minutes >= 0 && minutes <= 15;
  };

  const isHappeningNow = (startStr: string, endStr: string) => {
    const now = new Date();
    return new Date(startStr) <= now && now <= new Date(endStr);
  };

  // Group events by date
  const groupedEvents = events.reduce((groups, event) => {
    const dateLabel = getDateLabel(event.start);
    if (!groups[dateLabel]) {
      groups[dateLabel] = [];
    }
    groups[dateLabel].push(event);
    return groups;
  }, {} as Record<string, CalendarEvent[]>);

  return (
    <div className="space-y-6">
      {Object.entries(groupedEvents).map(([dateLabel, dayEvents]) => (
        <div key={dateLabel}>
          <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">
            {dateLabel}
          </h3>
          <div className="space-y-3">
            {dayEvents.map(event => {
              const meetingLink = event.meetingUrl || event.hangoutLink;
              const happeningSoon = isHappeningSoon(event.start);
              const happeningNow = isHappeningNow(event.start, event.end);

              return (
                <div
                  key={event.id}
                  className={`bg-card border rounded-xl p-4 transition-all ${
                    happeningNow
                      ? 'border-primary shadow-lg shadow-primary/20 ring-1 ring-primary'
                      : happeningSoon
                      ? 'border-yellow-500/50 shadow-md'
                      : 'border-border hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-foreground truncate">
                          {event.summary}
                        </h4>
                        {happeningNow && (
                          <span className="px-2 py-0.5 bg-primary text-primary-foreground text-xs rounded-full animate-pulse">
                            Live
                          </span>
                        )}
                        {happeningSoon && !happeningNow && (
                          <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 text-xs rounded-full">
                            Bald
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock size={14} />
                          {format(new Date(event.start), 'HH:mm')} - {format(new Date(event.end), 'HH:mm')}
                        </span>
                        <span className={`${happeningSoon || happeningNow ? 'text-primary font-medium' : ''}`}>
                          {getTimeUntil(event.start)}
                        </span>
                      </div>

                      {event.location && (
                        <p className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                          <MapPin size={14} />
                          <span className="truncate">{event.location}</span>
                        </p>
                      )}

                      {event.attendees.length > 0 && (
                        <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                          <Users size={14} />
                          <span>{event.attendees.length} Teilnehmer</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      {meetingLink && (
                        <Button
                          variant={happeningSoon || happeningNow ? 'default' : 'outline'}
                          size="sm"
                          className={happeningSoon || happeningNow ? 'gradient-hero' : ''}
                          asChild
                        >
                          <a href={meetingLink} target="_blank" rel="noopener noreferrer">
                            <Video size={14} className="mr-1" />
                            Beitreten
                          </a>
                        </Button>
                      )}
                      {onStartRecording && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onStartRecording(event)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          Aufnahme
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
