import { useRef, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { CalendarEvent } from '@/types/calendar';

// HMAC-SHA256 signature generation
async function generateSignature(payload: string, timestamp: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureData = `${timestamp}.${payload}`;
  const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(signatureData));
  return Array.from(new Uint8Array(signatureBytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Extract URL from text using regex
function extractUrl(text: string | null | undefined): string | null {
  if (!text) return null;
  const urlMatch = text.match(/(https?:\/\/[^\s]+)/);
  return urlMatch ? urlMatch[0] : null;
}

// Get signing secret from environment
const WEBHOOK_SIGNING_SECRET = import.meta.env.VITE_WEBHOOK_SIGNING_SECRET || '';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// LocalStorage key for persisting triggered webhooks
const TRIGGERED_WEBHOOKS_KEY = 'meeting:triggeredWebhooks';

// Load triggered webhooks from localStorage
function loadTriggeredWebhooks(): Set<string> {
  try {
    const stored = localStorage.getItem(TRIGGERED_WEBHOOKS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Filter out entries older than 24 hours
      const now = Date.now();
      const valid = Object.entries(parsed)
        .filter(([_, timestamp]) => now - (timestamp as number) < 24 * 60 * 60 * 1000)
        .map(([id]) => id);
      return new Set(valid);
    }
  } catch (e) {
    console.error('Failed to load triggered webhooks:', e);
  }
  return new Set();
}

// Save triggered webhooks to localStorage
function saveTriggeredWebhook(id: string): void {
  try {
    const stored = localStorage.getItem(TRIGGERED_WEBHOOKS_KEY);
    const data = stored ? JSON.parse(stored) : {};
    data[id] = Date.now();
    localStorage.setItem(TRIGGERED_WEBHOOKS_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save triggered webhook:', e);
  }
}

export const useMeetingBotWebhook = () => {
  const { toast } = useToast();
  const triggeredWebhooks = useRef<Set<string>>(loadTriggeredWebhooks());

  const triggerBotWebhook = useCallback(async (event: CalendarEvent) => {
    // Prevent duplicate webhook calls for the same meeting
    if (triggeredWebhooks.current.has(event.id)) {
      console.log('Webhook already triggered for meeting:', event.id);
      return;
    }

    // Priority: meetingUrl → hangoutLink → location → description
    const meetingUrl = event.meetingUrl 
      || event.hangoutLink 
      || extractUrl(event.location) 
      || extractUrl(event.description) 
      || null;

    // Don't send webhook if no meeting URL found
    if (!meetingUrl) {
      console.warn('No meeting URL found for event:', event.id, event.summary);
      toast({
        title: "Kein Meeting-Link",
        description: `"${event.summary}" hat keinen Konferenz-Link. Bitte fügen Sie einen Google Meet oder Zoom-Link hinzu.`,
        variant: "destructive",
        duration: 8000,
      });
      // Still mark as triggered to avoid repeated warnings
      triggeredWebhooks.current.add(event.id);
      saveTriggeredWebhook(event.id);
      return;
    }

    triggeredWebhooks.current.add(event.id);
    saveTriggeredWebhook(event.id);

    const payload = {
      meeting_id: event.id,
      meeting_url: meetingUrl,
      title: event.summary,
      start_time: event.start,
      end_time: event.end,
      attendees: event.attendees || [],
      triggered_at: new Date().toISOString(),
    };

    const payloadString = JSON.stringify(payload);
    const timestamp = Date.now().toString();

    console.log('Triggering meeting bot webhook:', payload);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'x-webhook-timestamp': timestamp,
      };

      // Add signature if secret is configured
      if (WEBHOOK_SIGNING_SECRET) {
        const signature = await generateSignature(payloadString, timestamp, WEBHOOK_SIGNING_SECRET);
        headers['x-webhook-signature'] = signature;
        console.log('Request signed with HMAC-SHA256');
      } else {
        console.warn('VITE_WEBHOOK_SIGNING_SECRET not configured - sending unsigned request');
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/meeting-bot-webhook`, {
        method: 'POST',
        headers,
        body: payloadString,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Webhook request failed');
      }

      const data = await response.json();
      console.log('Webhook response:', data);
      
      toast({
        title: "Bot benachrichtigt",
        description: `Meeting-Bot wurde für "${event.summary}" aktiviert`,
        duration: 5000,
      });

    } catch (error) {
      console.error('Failed to trigger webhook:', error);
      
      // Remove from triggered set so it can be retried
      triggeredWebhooks.current.delete(event.id);
      
      toast({
        title: "Webhook-Fehler",
        description: "Meeting-Bot konnte nicht benachrichtigt werden",
        variant: "destructive",
        duration: 5000,
      });
    }
  }, [toast]);

  // Clean up triggered webhooks for events that no longer exist
  const cleanupWebhooks = useCallback((currentEventIds: string[]) => {
    const currentIds = new Set(currentEventIds);
    triggeredWebhooks.current = new Set(
      [...triggeredWebhooks.current].filter(id => currentIds.has(id))
    );
  }, []);

  return {
    triggerBotWebhook,
    cleanupWebhooks,
  };
};
