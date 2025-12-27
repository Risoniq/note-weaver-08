import { RecallMeeting } from '@/hooks/useRecallCalendar';
import { Video, Clock, Users, Bot, BotOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { format, formatDistanceToNow, isToday, isTomorrow, differenceInMinutes } from 'date-fns';
import { de } from 'date-fns/locale';

interface RecallUpcomingMeetingsProps {
  meetings: RecallMeeting[];
  isLoading: boolean;
  onToggleRecording: (meetingId: string, shouldRecord: boolean) => void;
  onJoinMeeting: (meeting: RecallMeeting) => void;
}

export const RecallUpcomingMeetings = ({ 
  meetings, 
  isLoading, 
  onToggleRecording,
  onJoinMeeting,
}: RecallUpcomingMeetingsProps) => {
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

  if (meetings.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-center">
        <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
          <Video size={24} className="text-muted-foreground" />
        </div>
        <h3 className="font-medium text-foreground mb-1">Keine anstehenden Meetings</h3>
        <p className="text-sm text-muted-foreground">
          Meetings mit Video-Links erscheinen hier automatisch
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

  const getPlatformIcon = (platform: string | null) => {
    switch (platform?.toLowerCase()) {
      case 'zoom':
        return '🎦';
      case 'google_meet':
        return '📹';
      case 'microsoft_teams':
        return '👥';
      case 'webex':
        return '🌐';
      default:
        return '📺';
    }
  };

  // Group meetings by date
  const groupedMeetings = meetings.reduce((groups, meeting) => {
    const dateLabel = getDateLabel(meeting.start_time);
    if (!groups[dateLabel]) {
      groups[dateLabel] = [];
    }
    groups[dateLabel].push(meeting);
    return groups;
  }, {} as Record<string, RecallMeeting[]>);

  return (
    <div className="space-y-6">
      {Object.entries(groupedMeetings).map(([dateLabel, dayMeetings]) => (
        <div key={dateLabel}>
          <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">
            {dateLabel}
          </h3>
          <div className="space-y-3">
            {dayMeetings.map(meeting => {
              const happeningSoon = isHappeningSoon(meeting.start_time);
              const happeningNow = isHappeningNow(meeting.start_time, meeting.end_time);

              return (
                <div
                  key={meeting.id}
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
                        <span className="text-lg">{getPlatformIcon(meeting.platform)}</span>
                        <h4 className="font-medium text-foreground truncate">
                          {meeting.title}
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
                          {format(new Date(meeting.start_time), 'HH:mm')} - {format(new Date(meeting.end_time), 'HH:mm')}
                        </span>
                        <span className={`${happeningSoon || happeningNow ? 'text-primary font-medium' : ''}`}>
                          {getTimeUntil(meeting.start_time)}
                        </span>
                      </div>

                      {meeting.attendees.length > 0 && (
                        <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                          <Users size={14} />
                          <span>{meeting.attendees.length} Teilnehmer</span>
                        </div>
                      )}

                      {/* Bot status indicator */}
                      <div className="flex items-center gap-2 mt-2">
                        {meeting.will_record ? (
                          <div className="flex items-center gap-1 text-xs text-green-500">
                            <Bot size={14} />
                            <span>Bot wird beitreten</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <BotOff size={14} />
                            <span>Keine Aufnahme</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 items-end">
                      {/* Recording toggle */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Aufnahme</span>
                        <Switch
                          checked={meeting.will_record}
                          onCheckedChange={(checked) => onToggleRecording(meeting.id, checked)}
                        />
                      </div>

                      {meeting.meeting_url && (
                        <Button
                          variant={happeningSoon || happeningNow ? 'default' : 'outline'}
                          size="sm"
                          className={happeningSoon || happeningNow ? 'gradient-hero' : ''}
                          onClick={() => onJoinMeeting(meeting)}
                        >
                          <Video size={14} className="mr-1" />
                          Beitreten
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
