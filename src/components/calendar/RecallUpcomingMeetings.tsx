import { RecallMeeting } from '@/hooks/useRecallCalendarMeetings';
import { Video, Clock, Users, Bot, BotOff, AlertTriangle, RefreshCw, Loader2, LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { format, formatDistanceToNow, isToday, isTomorrow, differenceInMinutes } from 'date-fns';
import { de } from 'date-fns/locale';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface RecallUpcomingMeetingsProps {
  meetings: RecallMeeting[];
  isLoading: boolean;
  meetingsError?: string | null;
  onToggleRecording: (meetingId: string, shouldRecord: boolean) => void;
  onJoinMeeting: (meeting: RecallMeeting) => void;
  onRetry?: () => void;
  onBotStarted?: () => void;
  onRefreshCalendar?: () => void;
  isRefreshingCalendar?: boolean;
}

export const RecallUpcomingMeetings = ({ 
  meetings, 
  isLoading, 
  meetingsError,
  onToggleRecording,
  onJoinMeeting,
  onRetry,
  onBotStarted,
  onRefreshCalendar,
  isRefreshingCalendar,
}: RecallUpcomingMeetingsProps) => {
  const [startingBotFor, setStartingBotFor] = useState<string | null>(null);

  // Sort meetings by start_time and take only the first 5
  const sortedMeetings = [...meetings]
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    .slice(0, 5);

  // Start bot immediately when joining
  const handleJoinWithBot = async (meeting: RecallMeeting) => {
    if (!meeting.meeting_url) {
      toast.error('Kein Meeting-Link vorhanden');
      return;
    }

    setStartingBotFor(meeting.id);
    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Nicht angemeldet');
        return;
      }

      // Load bot settings from localStorage (same as Settings page)
      const botName = localStorage.getItem('bot:name') || 'Notetaker Bot';
      const botAvatarUrl = localStorage.getItem('bot:avatarUrl') || null;

      console.log('[RecallUpcomingMeetings] Sende Bot mit Einstellungen:', { botName, botAvatarUrl });

      // Start bot via create-bot function
      const { data, error } = await supabase.functions.invoke('create-bot', {
        body: {
          meetingUrl: meeting.meeting_url,
          botName,
          botAvatarUrl,
        },
      });

      if (error) {
        console.error('Error starting bot:', error);
        toast.error('Bot konnte nicht gestartet werden');
      } else if (data?.success) {
        toast.success('Bot tritt bei...');
        onBotStarted?.();
      }
    } catch (err) {
      console.error('Error starting bot:', err);
      toast.error('Fehler beim Starten des Bots');
    } finally {
      setStartingBotFor(null);
    }

    // Open meeting link regardless
    onJoinMeeting(meeting);
  };
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

  // Show error state with retry button
  if (meetingsError && meetings.length === 0) {
    return (
      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl p-6 text-center">
        <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/50 rounded-full flex items-center justify-center mx-auto mb-3">
          <AlertTriangle size={24} className="text-amber-600 dark:text-amber-400" />
        </div>
        <h3 className="font-medium text-amber-800 dark:text-amber-200 mb-2">
          Meetings konnten nicht geladen werden
        </h3>
        <p className="text-sm text-amber-700 dark:text-amber-300 mb-4">
          {meetingsError}
        </p>
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/50"
          >
            <RefreshCw size={14} className="mr-2" />
            Erneut laden
          </Button>
        )}
        <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-4">
          Der Bot zeichnet weiterhin automatisch auf – nur die Vorschau ist betroffen.
        </p>
      </div>
    );
  }

  if (sortedMeetings.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-center">
        <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
          <Video size={24} className="text-muted-foreground" />
        </div>
        <h3 className="font-medium text-foreground mb-1">Keine anstehenden Termine</h3>
        <p className="text-sm text-muted-foreground">
          Kalendertermine erscheinen hier automatisch. Der Bot tritt nur Terminen mit Meeting-Link bei.
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

  // Group sorted meetings by date
  const groupedMeetings = sortedMeetings.reduce((groups, meeting) => {
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
                        {meeting.meeting_url ? (
                          meeting.will_record ? (
                            <div className="flex items-center gap-1 text-xs text-green-500">
                              <Bot size={14} />
                              <span>Bot wird beitreten</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <BotOff size={14} />
                              <span>Keine Aufnahme</span>
                              {meeting.will_record_reason && (
                                <span className="text-xs opacity-70">– {meeting.will_record_reason}</span>
                              )}
                            </div>
                          )
                        ) : meeting.bot_id || meeting.will_record ? (
                          // Has bot assigned but no visible URL - bot will try to join
                          <div className="flex items-center gap-2 text-xs text-blue-500">
                            <Bot size={14} />
                            <span>Bot versucht beizutreten</span>
                            {onRefreshCalendar && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                                onClick={onRefreshCalendar}
                                disabled={isRefreshingCalendar}
                              >
                                <RefreshCw size={12} className={isRefreshingCalendar ? 'animate-spin' : ''} />
                                <span className="ml-1">Sync</span>
                              </Button>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-xs text-amber-500">
                            <LinkIcon size={14} />
                            <span>Kein Meeting-Link erkannt</span>
                            {onRefreshCalendar && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                                onClick={onRefreshCalendar}
                                disabled={isRefreshingCalendar}
                              >
                                <RefreshCw size={12} className={isRefreshingCalendar ? 'animate-spin' : ''} />
                                <span className="ml-1">Sync</span>
                              </Button>
                            )}
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
                          disabled={!meeting.meeting_url}
                        />
                      </div>

                      {meeting.meeting_url ? (
                        <Button
                          variant={happeningSoon || happeningNow ? 'default' : 'outline'}
                          size="sm"
                          className={happeningSoon || happeningNow ? 'gradient-hero' : ''}
                          onClick={() => handleJoinWithBot(meeting)}
                          disabled={startingBotFor === meeting.id}
                        >
                          {startingBotFor === meeting.id ? (
                            <>
                              <Loader2 size={14} className="mr-1 animate-spin" />
                              Bot startet...
                            </>
                          ) : (
                            <>
                              <Video size={14} className="mr-1" />
                              Beitreten
                            </>
                          )}
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled
                          className="opacity-50"
                        >
                          <LinkIcon size={14} className="mr-1" />
                          Kein Link
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
