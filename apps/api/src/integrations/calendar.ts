/**
 * Google Calendar Integration Adapter
 *
 * Supports two authentication modes:
 * 1. Service Account (recommended for CRM) - uses GOOGLE_SERVICE_ACCOUNT_KEY
 * 2. OAuth2 (user-delegated) - uses existing GOOGLE_CLIENT_ID/SECRET
 *
 * For HKF single-tenant deployment, service account is simpler.
 * Service account can create events on a shared calendar that all staff can see.
 */

import { google, calendar_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

// Configuration from environment
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_SERVICE_ACCOUNT_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY; // JSON string or file path
const GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'primary'; // Calendar to create events on
const GOOGLE_CALENDAR_REDIRECT_URI = process.env.GOOGLE_CALENDAR_REDIRECT_URI || 'http://localhost:3002/auth/google/callback';

// Token storage (in production, store in database per user)
let cachedOAuth2Client: OAuth2Client | null = null;
let serviceAccountCalendar: calendar_v3.Calendar | null = null;

/**
 * Initialize service account authentication
 * This is the recommended approach for CRM - events created on shared calendar
 */
async function getServiceAccountCalendar(): Promise<calendar_v3.Calendar | null> {
  if (serviceAccountCalendar) {
    return serviceAccountCalendar;
  }

  if (!GOOGLE_SERVICE_ACCOUNT_KEY) {
    console.log('[Calendar] No service account configured. Set GOOGLE_SERVICE_ACCOUNT_KEY env var.');
    return null;
  }

  try {
    // Parse service account key (can be JSON string or base64 encoded)
    let credentials: { client_email: string; private_key: string };

    if (GOOGLE_SERVICE_ACCOUNT_KEY.startsWith('{')) {
      credentials = JSON.parse(GOOGLE_SERVICE_ACCOUNT_KEY);
    } else {
      // Try base64 decode
      credentials = JSON.parse(Buffer.from(GOOGLE_SERVICE_ACCOUNT_KEY, 'base64').toString());
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });

    serviceAccountCalendar = google.calendar({ version: 'v3', auth });
    console.log('[Calendar] Service account initialized for:', credentials.client_email);
    return serviceAccountCalendar;
  } catch (error) {
    console.error('[Calendar] Failed to initialize service account:', error);
    return null;
  }
}

/**
 * Initialize OAuth2 client for user-delegated access
 * Use this if you need per-user calendar access
 */
function getOAuth2Client(): OAuth2Client {
  if (cachedOAuth2Client) {
    return cachedOAuth2Client;
  }

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error('Google OAuth credentials not configured');
  }

  cachedOAuth2Client = new OAuth2Client(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_CALENDAR_REDIRECT_URI
  );

  return cachedOAuth2Client;
}

/**
 * Generate OAuth2 authorization URL
 * User visits this URL to grant calendar access
 */
export function getAuthUrl(): string {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar'],
    prompt: 'consent', // Force consent screen to get refresh token
  });
}

/**
 * Exchange authorization code for tokens
 */
export async function handleAuthCallback(code: string): Promise<{ accessToken: string; refreshToken?: string }> {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  return {
    accessToken: tokens.access_token!,
    refreshToken: tokens.refresh_token || undefined,
  };
}

/**
 * Create a calendar event
 * Primary function for CRM integration
 */
export interface CalendarEventInput {
  title: string;
  description?: string;
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  location?: string;
  attendeeEmails?: string[];
  sendNotifications?: boolean;
  calendarId?: string; // Override default calendar
}

export interface CalendarEventResult {
  success: boolean;
  eventId?: string;
  eventLink?: string;
  message: string;
  error?: string;
}

export async function createCalendarEvent(input: CalendarEventInput): Promise<CalendarEventResult> {
  const { title, description, startTime, endTime, location, attendeeEmails = [], sendNotifications = true, calendarId } = input;

  // Try service account first (preferred for CRM)
  const calendar = await getServiceAccountCalendar();

  if (!calendar) {
    // No service account - return guidance
    return {
      success: false,
      message: 'Calendar integration not configured',
      error: 'Set GOOGLE_SERVICE_ACCOUNT_KEY environment variable with service account JSON credentials. ' +
             'Create a service account in Google Cloud Console, enable Google Calendar API, ' +
             'and share your calendar with the service account email.',
    };
  }

  try {
    const event: calendar_v3.Schema$Event = {
      summary: title,
      description: description || undefined,
      location: location || undefined,
      start: {
        dateTime: startTime,
        timeZone: 'Asia/Jerusalem', // HKF timezone
      },
      end: {
        dateTime: endTime,
        timeZone: 'Asia/Jerusalem',
      },
      attendees: attendeeEmails.map(email => ({ email })),
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 }, // 1 day before
          { method: 'popup', minutes: 30 }, // 30 minutes before
        ],
      },
    };

    const response = await calendar.events.insert({
      calendarId: calendarId || GOOGLE_CALENDAR_ID,
      requestBody: event,
      sendUpdates: sendNotifications ? 'all' : 'none',
    });

    console.log('[Calendar] Event created:', response.data.id);

    return {
      success: true,
      eventId: response.data.id || undefined,
      eventLink: response.data.htmlLink || undefined,
      message: `Calendar event "${title}" created successfully`,
    };
  } catch (error: any) {
    console.error('[Calendar] Failed to create event:', error.message);

    // Handle specific error cases
    if (error.code === 403) {
      return {
        success: false,
        message: 'Calendar access denied',
        error: 'The service account does not have access to this calendar. ' +
               'Share the calendar with the service account email address.',
      };
    }

    if (error.code === 404) {
      return {
        success: false,
        message: 'Calendar not found',
        error: `Calendar "${calendarId || GOOGLE_CALENDAR_ID}" not found. Check GOOGLE_CALENDAR_ID env var.`,
      };
    }

    return {
      success: false,
      message: 'Failed to create calendar event',
      error: error.message,
    };
  }
}

/**
 * Update an existing calendar event
 */
export async function updateCalendarEvent(
  eventId: string,
  updates: Partial<CalendarEventInput>
): Promise<CalendarEventResult> {
  const calendar = await getServiceAccountCalendar();

  if (!calendar) {
    return {
      success: false,
      message: 'Calendar integration not configured',
      error: 'Service account not configured',
    };
  }

  try {
    // First get the existing event
    const existingEvent = await calendar.events.get({
      calendarId: GOOGLE_CALENDAR_ID,
      eventId,
    });

    // Merge updates
    const updatedEvent: calendar_v3.Schema$Event = {
      ...existingEvent.data,
      summary: updates.title || existingEvent.data.summary,
      description: updates.description ?? existingEvent.data.description,
      location: updates.location ?? existingEvent.data.location,
    };

    if (updates.startTime) {
      updatedEvent.start = {
        dateTime: updates.startTime,
        timeZone: 'Asia/Jerusalem',
      };
    }

    if (updates.endTime) {
      updatedEvent.end = {
        dateTime: updates.endTime,
        timeZone: 'Asia/Jerusalem',
      };
    }

    if (updates.attendeeEmails) {
      updatedEvent.attendees = updates.attendeeEmails.map(email => ({ email }));
    }

    const response = await calendar.events.update({
      calendarId: GOOGLE_CALENDAR_ID,
      eventId,
      requestBody: updatedEvent,
      sendUpdates: updates.sendNotifications !== false ? 'all' : 'none',
    });

    return {
      success: true,
      eventId: response.data.id || undefined,
      eventLink: response.data.htmlLink || undefined,
      message: `Calendar event updated successfully`,
    };
  } catch (error: any) {
    console.error('[Calendar] Failed to update event:', error.message);
    return {
      success: false,
      message: 'Failed to update calendar event',
      error: error.message,
    };
  }
}

/**
 * Delete a calendar event
 */
export async function deleteCalendarEvent(
  eventId: string,
  sendNotifications = true
): Promise<CalendarEventResult> {
  const calendar = await getServiceAccountCalendar();

  if (!calendar) {
    return {
      success: false,
      message: 'Calendar integration not configured',
      error: 'Service account not configured',
    };
  }

  try {
    await calendar.events.delete({
      calendarId: GOOGLE_CALENDAR_ID,
      eventId,
      sendUpdates: sendNotifications ? 'all' : 'none',
    });

    return {
      success: true,
      message: 'Calendar event deleted successfully',
    };
  } catch (error: any) {
    console.error('[Calendar] Failed to delete event:', error.message);
    return {
      success: false,
      message: 'Failed to delete calendar event',
      error: error.message,
    };
  }
}

/**
 * List upcoming events from the calendar
 */
export async function listCalendarEvents(
  maxResults = 10,
  timeMin?: string
): Promise<{ success: boolean; events?: any[]; error?: string }> {
  const calendar = await getServiceAccountCalendar();

  if (!calendar) {
    return {
      success: false,
      error: 'Calendar integration not configured',
    };
  }

  try {
    const response = await calendar.events.list({
      calendarId: GOOGLE_CALENDAR_ID,
      timeMin: timeMin || new Date().toISOString(),
      maxResults,
      singleEvents: true,
      orderBy: 'startTime',
    });

    return {
      success: true,
      events: response.data.items?.map(event => ({
        id: event.id,
        title: event.summary,
        description: event.description,
        start: event.start?.dateTime || event.start?.date,
        end: event.end?.dateTime || event.end?.date,
        location: event.location,
        link: event.htmlLink,
        attendees: event.attendees?.map(a => a.email),
      })),
    };
  } catch (error: any) {
    console.error('[Calendar] Failed to list events:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Check if calendar integration is configured and working
 */
export async function checkCalendarStatus(): Promise<{
  configured: boolean;
  authenticated: boolean;
  calendarId: string;
  message: string;
}> {
  const calendar = await getServiceAccountCalendar();

  if (!calendar) {
    return {
      configured: false,
      authenticated: false,
      calendarId: GOOGLE_CALENDAR_ID,
      message: 'Service account not configured. Set GOOGLE_SERVICE_ACCOUNT_KEY env var.',
    };
  }

  try {
    // Try to access the calendar
    await calendar.calendarList.get({ calendarId: GOOGLE_CALENDAR_ID });

    return {
      configured: true,
      authenticated: true,
      calendarId: GOOGLE_CALENDAR_ID,
      message: 'Calendar integration is working',
    };
  } catch (error: any) {
    return {
      configured: true,
      authenticated: false,
      calendarId: GOOGLE_CALENDAR_ID,
      message: `Calendar access failed: ${error.message}`,
    };
  }
}
