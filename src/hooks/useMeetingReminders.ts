import { useEffect, useRef, useCallback } from 'react';
import { CalendarEvent } from '@/types/calendar';
import { useToast } from '@/hooks/use-toast';

interface ReminderSettings {
  enabled: boolean;
  minutesBefore: number;
}

export const useMeetingReminders = (
  events: CalendarEvent[],
  settings: ReminderSettings,
  onStartRecording?: (event: CalendarEvent) => void
) => {
  const { toast } = useToast();
  const shownReminders = useRef<Set<string>>(new Set());
  const notificationPermission = useRef<NotificationPermission>('default');

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window) {
      Notification.requestPermission().then(permission => {
        notificationPermission.current = permission;
      });
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
    if ('Notification' in window && notificationPermission.current === 'granted') {
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

      // Auto-close after 30 seconds
      setTimeout(() => notification.close(), 30000);
    }
  }, [toast, settings.minutesBefore]);

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

  // Clean up old reminders (older than 1 hour)
  useEffect(() => {
    const cleanup = () => {
      shownReminders.current = new Set(
        [...shownReminders.current].filter(id => {
          const eventId = id.split('-').slice(0, -1).join('-');
          return events.some(e => e.id === eventId);
        })
      );
    };

    cleanup();
  }, [events, settings.minutesBefore]);

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      notificationPermission.current = permission;
      return permission === 'granted';
    }
    return false;
  };

  return {
    requestNotificationPermission,
    notificationSupported: 'Notification' in window,
    notificationPermission: notificationPermission.current,
  };
};
