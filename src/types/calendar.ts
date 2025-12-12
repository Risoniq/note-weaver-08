export interface CalendarEvent {
  id: string;
  summary: string;
  description: string | null;
  start: string;
  end: string;
  location: string | null;
  meetingUrl: string | null;
  hangoutLink: string | null;
  attendees: {
    email: string;
    displayName?: string;
    responseStatus: string;
  }[];
}

export interface CalendarTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export type CalendarConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
