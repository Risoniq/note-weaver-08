import { useEffect, useRef, useCallback, useState } from 'react';
import { CalendarEvent } from '@/types/calendar';
import { useToast } from '@/hooks/use-toast';

interface ReminderSettings {
  enabled: boolean;
  minutesBefore: number;
}

export const useMeetingReminders = (
  events: CalendarEvent[],
  settings: ReminderSettings,
  onMeetingStart?: (event: CalendarEvent) => void
) => {
  const { toast } = useToast();
  const shownReminders = useRef<Set<string>>(new Set());
  const startedMeetings = useRef<Set<string>>(new Set());
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'default'
  );

  // Sync permission state on mount
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const showReminder = useCallback((event: CalendarEvent, minutesUntil: number) => {
    const reminderId = `${event.id}-${settings.minutesBefore}`;
    
    if (shownReminders.current.has(reminderId)) return;
    shownReminders.current.add(reminderId);

    const minuteText = minutesUntil <= 1 ? 'einer Minute' : `${Math.round(minutesUntil)} Minuten`;
    const message = `"${event.summary}" beginnt in ${minuteText}`;

    // In-App Toast
    toast({
      title: "Meeting-Erinnerung",
      description: message,
    });

    // Browser Push Notification
    if ('Notification' in window && notificationPermission === 'granted') {
      const notification = new Notification('Meeting-Erinnerung', {
        body: message,
        icon: '/favicon.ico',
        tag: reminderId,
        requireInteraction: true,
      });

      notification.onclick = () => {
        window.focus();
        if (event.meetingUrl || event.hangoutLink) {
          window.open(event.meetingUrl || event.hangoutLink || '', '_blank');
        }
        notification.close();
      };

      setTimeout(() => notification.close(), 30000);
    }
  }, [toast, settings.minutesBefore, notificationPermission]);

  const showMeetingStartNotification = useCallback((event: CalendarEvent) => {
    const startId = `start-${event.id}`;
    
    if (startedMeetings.current.has(startId)) return;
    startedMeetings.current.add(startId);

    const message = `"${event.summary}" startet JETZT!`;
    const meetingLink = event.meetingUrl || event.hangoutLink;

    // In-App Toast with action
    toast({
      title: "🔴 Meeting startet JETZT!",
      description: message,
      duration: 60000, // 1 minute
    });

    // Browser Push Notification
    if ('Notification' in window && notificationPermission === 'granted') {
      const notification = new Notification('🔴 Meeting startet JETZT!', {
        body: message + (meetingLink ? '\nKlicken zum Beitreten' : ''),
        icon: '/favicon.ico',
        tag: startId,
        requireInteraction: true,
      });

      notification.onclick = () => {
        window.focus();
        if (meetingLink) {
          window.open(meetingLink, '_blank');
        }
        notification.close();
      };

      // Keep notification visible for 2 minutes
      setTimeout(() => notification.close(), 120000);
    }

    // Trigger callback for automatic actions
    if (onMeetingStart) {
      onMeetingStart(event);
    }
  }, [toast, notificationPermission, onMeetingStart]);

  // Check for upcoming meetings
  useEffect(() => {
    if (!settings.enabled || events.length === 0) return;

    const checkReminders = () => {
      const now = Date.now();

      events.forEach(event => {
        const startTime = new Date(event.start).getTime();
        const minutesUntil = (startTime - now) / (1000 * 60);

        // Show reminder if within the configured window
        if (minutesUntil > 0 && minutesUntil <= settings.minutesBefore) {
          showReminder(event, minutesUntil);
        }
      });
    };

    // Check immediately and then every 30 seconds
    checkReminders();
    const interval = setInterval(checkReminders, 30000);

    return () => clearInterval(interval);
  }, [events, settings.enabled, settings.minutesBefore, showReminder]);

  // Check for meeting starts (current time >= start time)
  useEffect(() => {
    if (!settings.enabled || events.length === 0) return;

    const checkMeetingStarts = () => {
      const now = Date.now();
      console.log('[MeetingReminders] Checking meeting starts, events:', events.length);

      events.forEach(event => {
        const startTime = new Date(event.start).getTime();
        const endTime = new Date(event.end).getTime();
        const minutesSinceStart = (now - startTime) / (1000 * 60);

        console.log(`[MeetingReminders] Event "${event.summary}": minutesSinceStart=${minutesSinceStart.toFixed(2)}, inWindow=${minutesSinceStart >= -1 && minutesSinceStart <= 10}, notEnded=${now < endTime}`);

        // Meeting starts within 1 minute OR has started (within first 10 minutes) and hasn't ended
        if (minutesSinceStart >= -1 && minutesSinceStart <= 10 && now < endTime) {
          console.log(`[MeetingReminders] Triggering start notification for "${event.summary}"`);
          showMeetingStartNotification(event);
        }
      });
    };

    checkMeetingStarts();
    const interval = setInterval(checkMeetingStarts, 30000);

    return () => clearInterval(interval);
  }, [events, settings.enabled, showMeetingStartNotification]);

  // Clean up old reminders and started meetings
  useEffect(() => {
    const cleanup = () => {
      const eventIds = new Set(events.map(e => e.id));
      
      shownReminders.current = new Set(
        [...shownReminders.current].filter(id => {
          const eventId = id.split('-').slice(0, -1).join('-');
          return eventIds.has(eventId);
        })
      );
      
      startedMeetings.current = new Set(
        [...startedMeetings.current].filter(id => {
          const eventId = id.replace('start-', '');
          return eventIds.has(eventId);
        })
      );
    };

    cleanup();
  }, [events]);

  const requestNotificationPermission = async (): Promise<boolean> => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      return permission === 'granted';
    }
    return false;
  };

  return {
    requestNotificationPermission,
    notificationSupported: 'Notification' in window,
    notificationPermission,
  };
};
