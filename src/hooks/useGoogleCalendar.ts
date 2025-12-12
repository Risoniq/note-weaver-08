import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CalendarEvent, CalendarTokens, CalendarConnectionStatus } from '@/types/calendar';

const STORAGE_KEY = 'google:calendarTokens';
const REMINDER_STORAGE_KEY = 'google:reminderSettings';

interface ReminderSettings {
  enabled: boolean;
  minutesBefore: number;
}

export const useGoogleCalendar = () => {
  const [status, setStatus] = useState<CalendarConnectionStatus>('disconnected');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokens, setTokens] = useState<CalendarTokens | null>(null);
  const [reminderSettings, setReminderSettings] = useState<ReminderSettings>({
    enabled: true,
    minutesBefore: 5,
  });

  // Load tokens from localStorage
  useEffect(() => {
    const savedTokens = localStorage.getItem(STORAGE_KEY);
    if (savedTokens) {
      try {
        const parsed = JSON.parse(savedTokens) as CalendarTokens;
        if (parsed.expiresAt > Date.now()) {
          setTokens(parsed);
          setStatus('connected');
        } else if (parsed.refreshToken) {
          // Token expired, try to refresh
          refreshAccessToken(parsed.refreshToken);
        }
      } catch (e) {
        console.error('Failed to parse saved tokens:', e);
        localStorage.removeItem(STORAGE_KEY);
      }
    }

    const savedReminders = localStorage.getItem(REMINDER_STORAGE_KEY);
    if (savedReminders) {
      try {
        setReminderSettings(JSON.parse(savedReminders));
      } catch (e) {
        console.error('Failed to parse reminder settings:', e);
      }
    }
  }, []);

  // Save tokens to localStorage
  useEffect(() => {
    if (tokens) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
    }
  }, [tokens]);

  // Save reminder settings
  useEffect(() => {
    localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(reminderSettings));
  }, [reminderSettings]);

  const refreshAccessToken = async (refreshToken: string) => {
    try {
      setStatus('connecting');
      const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
        body: { action: 'refreshToken', refreshToken },
      });

      if (error) throw error;

      const newTokens: CalendarTokens = {
        accessToken: data.accessToken,
        refreshToken: refreshToken,
        expiresAt: Date.now() + (data.expiresIn - 60) * 1000,
      };

      setTokens(newTokens);
      setStatus('connected');
    } catch (e) {
      console.error('Failed to refresh token:', e);
      setStatus('error');
      setError('Sitzung abgelaufen. Bitte erneut verbinden.');
      disconnect();
    }
  };

  const getAuthUrl = async (): Promise<string> => {
    const redirectUri = `${window.location.origin}/calendar-callback`;
    
    const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
      body: { action: 'getAuthUrl', redirectUri },
    });

    if (error) throw error;
    return data.authUrl;
  };

  const connect = async () => {
    try {
      setStatus('connecting');
      setError(null);
      const authUrl = await getAuthUrl();
      
      // Open OAuth popup
      const width = 500;
      const height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      const popup = window.open(
        authUrl,
        'google-auth',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      // Listen for the callback
      const handleMessage = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        if (event.data?.type !== 'google-auth-callback') return;

        window.removeEventListener('message', handleMessage);
        popup?.close();

        if (event.data.error) {
          setStatus('error');
          setError(event.data.error);
          return;
        }

        // Exchange code for tokens
        try {
          const redirectUri = `${window.location.origin}/calendar-callback`;
          const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
            body: { action: 'exchangeCode', code: event.data.code, redirectUri },
          });

          if (error) throw error;

          const newTokens: CalendarTokens = {
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            expiresAt: Date.now() + (data.expiresIn - 60) * 1000,
          };

          setTokens(newTokens);
          setStatus('connected');
          
          // Fetch events immediately
          await fetchEvents(newTokens.accessToken);
        } catch (e: any) {
          console.error('Failed to exchange code:', e);
          setStatus('error');
          setError(e.message || 'Verbindung fehlgeschlagen');
        }
      };

      window.addEventListener('message', handleMessage);

      // Handle popup closed without completing auth
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', handleMessage);
          if (status === 'connecting') {
            setStatus('disconnected');
          }
        }
      }, 1000);

    } catch (e: any) {
      console.error('Failed to start auth:', e);
      setStatus('error');
      setError(e.message || 'Verbindung fehlgeschlagen');
    }
  };

  const disconnect = () => {
    setTokens(null);
    setEvents([]);
    setStatus('disconnected');
    setError(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const fetchEvents = useCallback(async (accessToken?: string) => {
    const token = accessToken || tokens?.accessToken;
    if (!token) return;

    // Check if token needs refresh
    if (tokens && tokens.expiresAt < Date.now() + 60000) {
      await refreshAccessToken(tokens.refreshToken);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-events', {
        body: { accessToken: token },
      });

      if (error) throw error;

      setEvents(data.events || []);
    } catch (e: any) {
      console.error('Failed to fetch events:', e);
      if (e.message?.includes('401') || e.message?.includes('403')) {
        // Token invalid, try to refresh
        if (tokens?.refreshToken) {
          await refreshAccessToken(tokens.refreshToken);
        } else {
          setStatus('error');
          setError('Sitzung abgelaufen. Bitte erneut verbinden.');
        }
      } else {
        setError(e.message || 'Fehler beim Laden der Termine');
      }
    } finally {
      setIsLoading(false);
    }
  }, [tokens]);

  // Auto-refresh events every 5 minutes when connected
  useEffect(() => {
    if (status === 'connected' && tokens) {
      fetchEvents();
      const interval = setInterval(() => fetchEvents(), 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [status, fetchEvents]);

  const updateReminderSettings = (settings: Partial<ReminderSettings>) => {
    setReminderSettings(prev => ({ ...prev, ...settings }));
  };

  return {
    status,
    events,
    isLoading,
    error,
    connect,
    disconnect,
    fetchEvents,
    reminderSettings,
    updateReminderSettings,
  };
};
