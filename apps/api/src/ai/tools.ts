import { z } from 'zod';
import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import { db, people, programs, interviews, enrollments, payments, events, eventRegistrations, escalations, communications } from '@generic-ai-crm/db';
import { eq, and, ilike, or, gte, lte, sql, count } from 'drizzle-orm';
import { createCalendarEvent as googleCreateCalendarEvent, checkCalendarStatus } from '../integrations/calendar.js';
import { sendEmail, sendBulkEmail, emailTemplates, checkEmailStatus } from '../integrations/email.js';

/**
 * AI Tool definitions for JARVIS
 * Based on the 18 tools from the AI Orchestration Specification
 * Each tool has a Zod schema for input validation and a handler function
 */

// ============================================================================
// Tool Schemas (Zod for validation)
// ============================================================================

export const searchPeopleSchema = z.object({
  query: z.string().optional().describe('Search query - matches against name, email, or phone'),
  status: z.enum(['active', 'inactive', 'pending', 'archived']).optional().describe('Filter by status'),
  limit: z.number().min(1).max(100).default(20).describe('Maximum number of results'),
});

export const getPersonSchema = z.object({
  personId: z.string().uuid().describe('UUID of the person to retrieve'),
});

export const createPersonSchema = z.object({
  firstName: z.string().min(1).describe('First name (required)'),
  lastName: z.string().min(1).describe('Last name (required)'),
  email: z.string().email().optional().describe('Email address'),
  phone: z.string().optional().describe('Phone number'),
  status: z.enum(['active', 'inactive', 'pending']).default('pending').describe('Initial status'),
  metadata: z.record(z.unknown()).optional().describe('Additional custom fields'),
  tags: z.array(z.string()).optional().describe('Tags for categorization'),
});

export const updatePersonSchema = z.object({
  personId: z.string().uuid().describe('UUID of the person to update'),
  firstName: z.string().optional().describe('New first name'),
  lastName: z.string().optional().describe('New last name'),
  email: z.string().email().optional().describe('New email address'),
  phone: z.string().optional().describe('New phone number'),
  status: z.enum(['active', 'inactive', 'pending', 'archived']).optional().describe('New status'),
  metadata: z.record(z.unknown()).optional().describe('New/updated metadata fields'),
  tags: z.array(z.string()).optional().describe('New tags'),
});

export const listProgramsSchema = z.object({
  type: z.string().optional().describe('Filter by program type (e.g., course, membership, track)'),
  isActive: z.boolean().optional().describe('Filter by active status'),
  limit: z.number().min(1).max(100).default(20).describe('Maximum number of results'),
});

export const getProgramSchema = z.object({
  programId: z.string().uuid().describe('UUID of the program to retrieve'),
});

export const scheduleInterviewSchema = z.object({
  personId: z.string().uuid().describe('UUID of the person to interview'),
  programId: z.string().uuid().describe('UUID of the program the interview is for'),
  scheduledAt: z.string().describe('ISO 8601 datetime for the interview (e.g., 2025-01-15T14:00:00Z)'),
  durationMinutes: z.string().default('30').describe('Duration in minutes (default: 30)'),
  location: z.string().optional().describe('Interview location - Zoom link, phone number, or physical address'),
  enrollmentId: z.string().uuid().optional().describe('Optional enrollment ID if person has already applied'),
});

export const recordInterviewOutcomeSchema = z.object({
  interviewId: z.string().uuid().describe('UUID of the interview to record outcome for'),
  outcome: z.enum(['passed', 'failed', 'pending_decision']).describe('Interview outcome'),
  notes: z.string().optional().describe('General notes about the interview'),
  score: z.number().min(1).max(10).optional().describe('Score from 1-10'),
  strengths: z.array(z.string()).optional().describe('List of candidate strengths observed'),
  concerns: z.array(z.string()).optional().describe('List of concerns about the candidate'),
  recommendation: z.string().optional().describe('Interviewer recommendation text'),
});

export const listInterviewsSchema = z.object({
  personId: z.string().uuid().optional().describe('Filter by person'),
  programId: z.string().uuid().optional().describe('Filter by program'),
  status: z.enum(['scheduled', 'completed', 'cancelled', 'no_show']).optional().describe('Filter by status'),
  fromDate: z.string().optional().describe('Filter interviews from this date (ISO 8601)'),
  toDate: z.string().optional().describe('Filter interviews until this date (ISO 8601)'),
  limit: z.number().min(1).max(100).default(20).describe('Maximum number of results'),
});

export const createEnrollmentSchema = z.object({
  personId: z.string().uuid().describe('UUID of the person to enroll'),
  programId: z.string().uuid().describe('UUID of the program to enroll in'),
  cohortId: z.string().uuid().optional().describe('Optional cohort ID'),
  applicationData: z.record(z.unknown()).optional().describe('Application form responses'),
  status: z.enum(['applied', 'interviewing', 'accepted', 'rejected', 'enrolled', 'completed', 'dropped']).default('applied').describe('Initial enrollment status'),
});

export const updateEnrollmentStatusSchema = z.object({
  enrollmentId: z.string().uuid().describe('UUID of the enrollment to update'),
  status: z.enum(['applied', 'interviewing', 'accepted', 'rejected', 'enrolled', 'completed', 'dropped']).describe('New enrollment status'),
  notes: z.string().optional().describe('Notes about the status change'),
});

export const sendMessageSchema = z.object({
  personId: z.string().uuid().describe('UUID of the person to message'),
  channel: z.enum(['email', 'whatsapp', 'sms']).describe('Communication channel'),
  subject: z.string().optional().describe('Email subject (required for email channel)'),
  message: z.string().describe('Message content'),
  templateId: z.string().optional().describe('Optional template ID for predefined messages'),
});

export const recordPaymentSchema = z.object({
  personId: z.string().uuid().describe('UUID of the person who made the payment'),
  amount: z.number().positive().describe('Payment amount in the smallest currency unit (e.g., cents)'),
  currency: z.string().default('ILS').describe('Currency code (default: ILS)'),
  description: z.string().optional().describe('Payment description'),
  programId: z.string().uuid().optional().describe('UUID of the program this payment is for'),
  enrollmentId: z.string().uuid().optional().describe('UUID of the enrollment this payment is for'),
  status: z.enum(['pending', 'completed', 'failed', 'refunded', 'cancelled']).default('completed').describe('Payment status'),
  provider: z.string().optional().describe('Payment provider (e.g., meshulam, stripe)'),
  externalId: z.string().optional().describe('Transaction ID from payment provider'),
  paymentMethod: z.string().optional().describe('Payment method (e.g., credit_card, bank_transfer, cash)'),
});

export const listPaymentsSchema = z.object({
  personId: z.string().uuid().optional().describe('Filter by person'),
  programId: z.string().uuid().optional().describe('Filter by program'),
  enrollmentId: z.string().uuid().optional().describe('Filter by enrollment'),
  status: z.enum(['pending', 'completed', 'failed', 'refunded', 'cancelled']).optional().describe('Filter by status'),
  limit: z.number().min(1).max(100).default(20).describe('Maximum number of results'),
});

export const listEnrollmentsSchema = z.object({
  personId: z.string().uuid().optional().describe('Filter by person'),
  programId: z.string().uuid().optional().describe('Filter by program'),
  status: z.enum(['applied', 'interviewing', 'accepted', 'rejected', 'enrolled', 'completed', 'dropped']).optional().describe('Filter by enrollment status'),
  limit: z.number().min(1).max(100).default(20).describe('Maximum number of results'),
});

export const getInterviewSchema = z.object({
  interviewId: z.string().uuid().describe('UUID of the interview to retrieve'),
});

// ============================================================================
// NEW TOOL SCHEMAS (9 additional tools from AI Orchestration Spec)
// ============================================================================

export const sendBulkMessageSchema = z.object({
  channel: z.enum(['email', 'whatsapp', 'sms']).describe('Communication channel'),
  audienceFilter: z.object({
    programIds: z.array(z.string().uuid()).optional().describe('Filter by program IDs'),
    cohortIds: z.array(z.string().uuid()).optional().describe('Filter by cohort IDs'),
    statuses: z.array(z.string()).optional().describe('Filter by person status'),
    tags: z.array(z.string()).optional().describe('Filter by tags'),
  }).describe('Audience targeting criteria'),
  subject: z.string().optional().describe('Email subject (required for email channel)'),
  message: z.string().describe('Message content - supports {{first_name}}, {{last_name}} variables'),
  templateId: z.string().optional().describe('Optional template ID'),
});

export const createEventSchema = z.object({
  name: z.string().describe('Event name'),
  description: z.string().optional().describe('Event description'),
  type: z.string().optional().describe('Event type (e.g., workshop, meeting, webinar)'),
  startsAt: z.string().describe('ISO 8601 datetime for event start'),
  endsAt: z.string().optional().describe('ISO 8601 datetime for event end'),
  location: z.string().optional().describe('Physical location or "online"'),
  locationUrl: z.string().optional().describe('Zoom/Meet link for online events'),
  capacity: z.number().optional().describe('Maximum number of attendees'),
  targetAudience: z.object({
    programIds: z.array(z.string().uuid()).optional(),
    cohortIds: z.array(z.string().uuid()).optional(),
    statuses: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
  }).optional().describe('Who should be invited'),
});

export const registerForEventSchema = z.object({
  eventId: z.string().uuid().describe('UUID of the event'),
  personId: z.string().uuid().describe('UUID of the person to register'),
  guests: z.number().optional().describe('Number of additional guests (default: 0)'),
  notes: z.string().optional().describe('Registration notes'),
});

export const checkInEventSchema = z.object({
  eventId: z.string().uuid().describe('UUID of the event'),
  personId: z.string().uuid().describe('UUID of the person to check in'),
});

export const createPaymentLinkSchema = z.object({
  personId: z.string().uuid().describe('UUID of the person'),
  amount: z.number().positive().describe('Amount in smallest currency unit (e.g., agorot for ILS)'),
  currency: z.string().default('ILS').describe('Currency code'),
  description: z.string().describe('Payment description shown to payer'),
  programId: z.string().uuid().optional().describe('UUID of the program this payment is for'),
  enrollmentId: z.string().uuid().optional().describe('UUID of the enrollment'),
  allowInstallments: z.boolean().optional().describe('Allow payment in installments'),
  maxInstallments: z.number().optional().describe('Maximum number of installments'),
});

export const createCalendarEventSchema = z.object({
  title: z.string().describe('Calendar event title'),
  description: z.string().optional().describe('Event description'),
  startTime: z.string().describe('ISO 8601 start datetime'),
  endTime: z.string().describe('ISO 8601 end datetime'),
  location: z.string().optional().describe('Event location'),
  attendeeEmails: z.array(z.string().email()).optional().describe('Email addresses to invite'),
  attendeePersonIds: z.array(z.string().uuid()).optional().describe('Person IDs to invite (will lookup emails)'),
});

export const uploadFileSchema = z.object({
  fileName: z.string().describe('Name for the uploaded file'),
  fileType: z.string().describe('MIME type (e.g., application/pdf, image/jpeg)'),
  folder: z.string().optional().describe('Folder path in storage (e.g., /documents/cvs)'),
  personId: z.string().uuid().optional().describe('Associate file with a person'),
  description: z.string().optional().describe('File description'),
});

export const escalateToHumanSchema = z.object({
  reason: z.string().describe('Why this needs human attention'),
  urgency: z.enum(['low', 'medium', 'high', 'critical']).default('medium').describe('Urgency level'),
  personId: z.string().uuid().optional().describe('Related person ID'),
  enrollmentId: z.string().uuid().optional().describe('Related enrollment ID'),
  interviewId: z.string().uuid().optional().describe('Related interview ID'),
  context: z.object({
    lastMessage: z.string().optional(),
    conversationSummary: z.string().optional(),
    actionsTaken: z.array(z.string()).optional(),
    suggestedActions: z.array(z.string()).optional(),
  }).optional().describe('Additional context for the reviewer'),
  assignTo: z.string().uuid().optional().describe('Specific staff member to assign to'),
});

export const calculateEngagementScoreSchema = z.object({
  personId: z.string().uuid().describe('UUID of the person to calculate score for'),
});

// Type exports
export type SearchPeopleInput = z.infer<typeof searchPeopleSchema>;
export type GetPersonInput = z.infer<typeof getPersonSchema>;
export type CreatePersonInput = z.infer<typeof createPersonSchema>;
export type UpdatePersonInput = z.infer<typeof updatePersonSchema>;
export type ListProgramsInput = z.infer<typeof listProgramsSchema>;
export type GetProgramInput = z.infer<typeof getProgramSchema>;
export type ScheduleInterviewInput = z.infer<typeof scheduleInterviewSchema>;
export type RecordInterviewOutcomeInput = z.infer<typeof recordInterviewOutcomeSchema>;
export type ListInterviewsInput = z.infer<typeof listInterviewsSchema>;
export type CreateEnrollmentInput = z.infer<typeof createEnrollmentSchema>;
export type UpdateEnrollmentStatusInput = z.infer<typeof updateEnrollmentStatusSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
export type ListPaymentsInput = z.infer<typeof listPaymentsSchema>;
export type ListEnrollmentsInput = z.infer<typeof listEnrollmentsSchema>;
export type GetInterviewInput = z.infer<typeof getInterviewSchema>;
export type SendBulkMessageInput = z.infer<typeof sendBulkMessageSchema>;
export type CreateEventInput = z.infer<typeof createEventSchema>;
export type RegisterForEventInput = z.infer<typeof registerForEventSchema>;
export type CheckInEventInput = z.infer<typeof checkInEventSchema>;
export type CreatePaymentLinkInput = z.infer<typeof createPaymentLinkSchema>;
export type CreateCalendarEventInput = z.infer<typeof createCalendarEventSchema>;
export type UploadFileInput = z.infer<typeof uploadFileSchema>;
export type EscalateToHumanInput = z.infer<typeof escalateToHumanSchema>;
export type CalculateEngagementScoreInput = z.infer<typeof calculateEngagementScoreSchema>;

// ============================================================================
// Tool Definitions for Claude API
// ============================================================================

export function getToolDefinitions(): Tool[] {
  return [
    {
      name: 'search_people',
      description: 'Search for people in the CRM by name, email, phone, or status. Returns a list of matching people.',
      input_schema: {
        type: 'object' as const,
        properties: {
          query: {
            type: 'string',
            description: 'Search query - matches against first name, last name, email, or phone',
          },
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'pending', 'archived'],
            description: 'Filter by status',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results (default: 20, max: 100)',
          },
        },
        required: [],
      },
    },
    {
      name: 'get_person',
      description: 'Get detailed information about a specific person by their ID.',
      input_schema: {
        type: 'object' as const,
        properties: {
          personId: {
            type: 'string',
            description: 'UUID of the person to retrieve',
          },
        },
        required: ['personId'],
      },
    },
    {
      name: 'create_person',
      description: 'Create a new person record in the CRM. Requires first and last name.',
      input_schema: {
        type: 'object' as const,
        properties: {
          firstName: {
            type: 'string',
            description: 'First name (required)',
          },
          lastName: {
            type: 'string',
            description: 'Last name (required)',
          },
          email: {
            type: 'string',
            description: 'Email address',
          },
          phone: {
            type: 'string',
            description: 'Phone number',
          },
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'pending'],
            description: 'Initial status (default: pending)',
          },
          metadata: {
            type: 'object',
            description: 'Additional custom fields as key-value pairs',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Tags for categorization',
          },
        },
        required: ['firstName', 'lastName'],
      },
    },
    {
      name: 'update_person',
      description: 'Update an existing person record. Only provided fields will be updated.',
      input_schema: {
        type: 'object' as const,
        properties: {
          personId: {
            type: 'string',
            description: 'UUID of the person to update',
          },
          firstName: {
            type: 'string',
            description: 'New first name',
          },
          lastName: {
            type: 'string',
            description: 'New last name',
          },
          email: {
            type: 'string',
            description: 'New email address',
          },
          phone: {
            type: 'string',
            description: 'New phone number',
          },
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'pending', 'archived'],
            description: 'New status',
          },
          metadata: {
            type: 'object',
            description: 'New/updated metadata fields',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'New tags',
          },
        },
        required: ['personId'],
      },
    },
    {
      name: 'list_programs',
      description: 'List all programs in the organization. Programs can be courses, memberships, tracks, or other types defined by the organization.',
      input_schema: {
        type: 'object' as const,
        properties: {
          type: {
            type: 'string',
            description: 'Filter by program type (e.g., course, membership, track)',
          },
          isActive: {
            type: 'boolean',
            description: 'Filter by active status (true for active only, false for inactive only)',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results (default: 20, max: 100)',
          },
        },
        required: [],
      },
    },
    {
      name: 'get_program',
      description: 'Get detailed information about a specific program by its ID, including configuration, requirements, and application fields.',
      input_schema: {
        type: 'object' as const,
        properties: {
          programId: {
            type: 'string',
            description: 'UUID of the program to retrieve',
          },
        },
        required: ['programId'],
      },
    },
    {
      name: 'schedule_interview',
      description: 'Schedule an interview for a person applying to a program. Creates an interview record with date, time, location, and links to the person and program.',
      input_schema: {
        type: 'object' as const,
        properties: {
          personId: {
            type: 'string',
            description: 'UUID of the person to interview',
          },
          programId: {
            type: 'string',
            description: 'UUID of the program the interview is for',
          },
          scheduledAt: {
            type: 'string',
            description: 'ISO 8601 datetime for the interview (e.g., 2025-01-15T14:00:00Z)',
          },
          durationMinutes: {
            type: 'string',
            description: 'Duration in minutes (default: 30)',
          },
          location: {
            type: 'string',
            description: 'Interview location - Zoom link, phone number, or physical address',
          },
          enrollmentId: {
            type: 'string',
            description: 'Optional enrollment ID if person has already applied',
          },
        },
        required: ['personId', 'programId', 'scheduledAt'],
      },
    },
    {
      name: 'record_interview_outcome',
      description: 'Record the outcome of a completed interview. Updates the interview with score, notes, strengths, concerns, and final outcome (passed/failed/pending_decision).',
      input_schema: {
        type: 'object' as const,
        properties: {
          interviewId: {
            type: 'string',
            description: 'UUID of the interview to record outcome for',
          },
          outcome: {
            type: 'string',
            enum: ['passed', 'failed', 'pending_decision'],
            description: 'Interview outcome',
          },
          notes: {
            type: 'string',
            description: 'General notes about the interview',
          },
          score: {
            type: 'number',
            description: 'Score from 1-10',
          },
          strengths: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of candidate strengths observed',
          },
          concerns: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of concerns about the candidate',
          },
          recommendation: {
            type: 'string',
            description: 'Interviewer recommendation text',
          },
        },
        required: ['interviewId', 'outcome'],
      },
    },
    {
      name: 'list_interviews',
      description: 'List interviews with optional filters by person, program, status, or date range.',
      input_schema: {
        type: 'object' as const,
        properties: {
          personId: {
            type: 'string',
            description: 'Filter by person UUID',
          },
          programId: {
            type: 'string',
            description: 'Filter by program UUID',
          },
          status: {
            type: 'string',
            enum: ['scheduled', 'completed', 'cancelled', 'no_show'],
            description: 'Filter by interview status',
          },
          fromDate: {
            type: 'string',
            description: 'Filter interviews from this date (ISO 8601)',
          },
          toDate: {
            type: 'string',
            description: 'Filter interviews until this date (ISO 8601)',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results (default: 20, max: 100)',
          },
        },
        required: [],
      },
    },
    {
      name: 'create_enrollment',
      description: 'Create an enrollment (application) for a person to a program. This links a person to a program and tracks their application progress.',
      input_schema: {
        type: 'object' as const,
        properties: {
          personId: {
            type: 'string',
            description: 'UUID of the person to enroll',
          },
          programId: {
            type: 'string',
            description: 'UUID of the program to enroll in',
          },
          cohortId: {
            type: 'string',
            description: 'Optional cohort ID',
          },
          applicationData: {
            type: 'object',
            description: 'Application form responses as key-value pairs',
          },
          status: {
            type: 'string',
            enum: ['applied', 'interviewing', 'accepted', 'rejected', 'enrolled', 'completed', 'dropped'],
            description: 'Initial enrollment status (default: applied)',
          },
        },
        required: ['personId', 'programId'],
      },
    },
    {
      name: 'update_enrollment_status',
      description: 'Update the status of an enrollment (move application through the pipeline).',
      input_schema: {
        type: 'object' as const,
        properties: {
          enrollmentId: {
            type: 'string',
            description: 'UUID of the enrollment to update',
          },
          status: {
            type: 'string',
            enum: ['applied', 'interviewing', 'accepted', 'rejected', 'enrolled', 'completed', 'dropped'],
            description: 'New enrollment status',
          },
          notes: {
            type: 'string',
            description: 'Notes about the status change',
          },
        },
        required: ['enrollmentId', 'status'],
      },
    },
    {
      name: 'send_message',
      description: 'Send a message to a person via email, WhatsApp, or SMS. Email is fully integrated via Brevo. WhatsApp and SMS are pending integration. IMPORTANT: You must first use search_people to find the person by name and get their personId before calling this tool.',
      input_schema: {
        type: 'object' as const,
        properties: {
          personId: {
            type: 'string',
            description: 'UUID of the person to message. REQUIRED: First use search_people to find this ID by searching for the person\'s name.',
          },
          channel: {
            type: 'string',
            enum: ['email', 'whatsapp', 'sms'],
            description: 'Communication channel',
          },
          subject: {
            type: 'string',
            description: 'Email subject (required for email channel)',
          },
          message: {
            type: 'string',
            description: 'Message content',
          },
          templateId: {
            type: 'string',
            description: 'Optional template ID for predefined messages',
          },
        },
        required: ['personId', 'channel', 'message'],
      },
    },
    {
      name: 'record_payment',
      description: 'Record a payment from a person. Can be linked to a program or enrollment. Amounts are in the smallest currency unit (e.g., cents for USD, agorot for ILS).',
      input_schema: {
        type: 'object' as const,
        properties: {
          personId: {
            type: 'string',
            description: 'UUID of the person who made the payment',
          },
          amount: {
            type: 'number',
            description: 'Payment amount in smallest currency unit (e.g., 350000 for 3500 ILS)',
          },
          currency: {
            type: 'string',
            description: 'Currency code (default: ILS)',
          },
          description: {
            type: 'string',
            description: 'Payment description',
          },
          programId: {
            type: 'string',
            description: 'UUID of the program this payment is for',
          },
          enrollmentId: {
            type: 'string',
            description: 'UUID of the enrollment this payment is for',
          },
          status: {
            type: 'string',
            enum: ['pending', 'completed', 'failed', 'refunded', 'cancelled'],
            description: 'Payment status (default: completed)',
          },
          provider: {
            type: 'string',
            description: 'Payment provider (e.g., meshulam, stripe)',
          },
          externalId: {
            type: 'string',
            description: 'Transaction ID from payment provider',
          },
          paymentMethod: {
            type: 'string',
            description: 'Payment method (e.g., credit_card, bank_transfer, cash)',
          },
        },
        required: ['personId', 'amount'],
      },
    },
    {
      name: 'list_payments',
      description: 'List payments with optional filters by person, program, enrollment, or status.',
      input_schema: {
        type: 'object' as const,
        properties: {
          personId: {
            type: 'string',
            description: 'Filter by person UUID',
          },
          programId: {
            type: 'string',
            description: 'Filter by program UUID',
          },
          enrollmentId: {
            type: 'string',
            description: 'Filter by enrollment UUID',
          },
          status: {
            type: 'string',
            enum: ['pending', 'completed', 'failed', 'refunded', 'cancelled'],
            description: 'Filter by payment status',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results (default: 20, max: 100)',
          },
        },
        required: [],
      },
    },
    {
      name: 'list_enrollments',
      description: 'List enrollments with optional filters by person, program, or status. Shows application progress for people in programs.',
      input_schema: {
        type: 'object' as const,
        properties: {
          personId: {
            type: 'string',
            description: 'Filter by person UUID',
          },
          programId: {
            type: 'string',
            description: 'Filter by program UUID',
          },
          status: {
            type: 'string',
            enum: ['applied', 'interviewing', 'accepted', 'rejected', 'enrolled', 'completed', 'dropped'],
            description: 'Filter by enrollment status',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results (default: 20, max: 100)',
          },
        },
        required: [],
      },
    },
    {
      name: 'get_interview',
      description: 'Get detailed information about a specific interview including person and program details.',
      input_schema: {
        type: 'object' as const,
        properties: {
          interviewId: {
            type: 'string',
            description: 'UUID of the interview to retrieve',
          },
        },
        required: ['interviewId'],
      },
    },
    // ========== NEW TOOLS (9 additional) ==========
    {
      name: 'send_bulk_message',
      description: 'Send a message to multiple recipients filtered by audience criteria. Email is fully integrated via Brevo. WhatsApp and SMS are pending. Use {{first_name}} and {{last_name}} for personalization.',
      input_schema: {
        type: 'object' as const,
        properties: {
          channel: {
            type: 'string',
            enum: ['email', 'whatsapp', 'sms'],
            description: 'Communication channel',
          },
          audienceFilter: {
            type: 'object',
            properties: {
              programIds: { type: 'array', items: { type: 'string' }, description: 'Filter by program IDs' },
              cohortIds: { type: 'array', items: { type: 'string' }, description: 'Filter by cohort IDs' },
              statuses: { type: 'array', items: { type: 'string' }, description: 'Filter by person status' },
              tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags' },
            },
            description: 'Audience targeting criteria',
          },
          subject: {
            type: 'string',
            description: 'Email subject (required for email channel)',
          },
          message: {
            type: 'string',
            description: 'Message content - supports {{first_name}}, {{last_name}} variables',
          },
          templateId: {
            type: 'string',
            description: 'Optional template ID for predefined messages',
          },
        },
        required: ['channel', 'audienceFilter', 'message'],
      },
    },
    {
      name: 'create_event',
      description: 'Create a new event (workshop, meeting, webinar, etc.) with optional targeting criteria for invitations.',
      input_schema: {
        type: 'object' as const,
        properties: {
          name: { type: 'string', description: 'Event name' },
          description: { type: 'string', description: 'Event description' },
          type: { type: 'string', description: 'Event type (workshop, meeting, webinar, etc.)' },
          startsAt: { type: 'string', description: 'ISO 8601 datetime for event start' },
          endsAt: { type: 'string', description: 'ISO 8601 datetime for event end' },
          location: { type: 'string', description: 'Physical location or "online"' },
          locationUrl: { type: 'string', description: 'Zoom/Meet link for online events' },
          capacity: { type: 'number', description: 'Maximum number of attendees' },
          targetAudience: {
            type: 'object',
            properties: {
              programIds: { type: 'array', items: { type: 'string' } },
              cohortIds: { type: 'array', items: { type: 'string' } },
              statuses: { type: 'array', items: { type: 'string' } },
              tags: { type: 'array', items: { type: 'string' } },
            },
            description: 'Who should be invited to this event',
          },
        },
        required: ['name', 'startsAt'],
      },
    },
    {
      name: 'register_for_event',
      description: 'Register a person for an event. Checks capacity and handles waitlist if full.',
      input_schema: {
        type: 'object' as const,
        properties: {
          eventId: { type: 'string', description: 'UUID of the event' },
          personId: { type: 'string', description: 'UUID of the person to register' },
          guests: { type: 'number', description: 'Number of additional guests (default: 0)' },
          notes: { type: 'string', description: 'Registration notes' },
        },
        required: ['eventId', 'personId'],
      },
    },
    {
      name: 'check_in_event',
      description: 'Mark a person as attended at an event. Records check-in timestamp.',
      input_schema: {
        type: 'object' as const,
        properties: {
          eventId: { type: 'string', description: 'UUID of the event' },
          personId: { type: 'string', description: 'UUID of the person to check in' },
        },
        required: ['eventId', 'personId'],
      },
    },
    {
      name: 'create_payment_link',
      description: 'Generate a payment link for a person. Currently returns a stub - Meshulam integration coming soon.',
      input_schema: {
        type: 'object' as const,
        properties: {
          personId: { type: 'string', description: 'UUID of the person' },
          amount: { type: 'number', description: 'Amount in smallest currency unit (agorot for ILS)' },
          currency: { type: 'string', description: 'Currency code (default: ILS)' },
          description: { type: 'string', description: 'Payment description shown to payer' },
          programId: { type: 'string', description: 'UUID of the program this payment is for' },
          enrollmentId: { type: 'string', description: 'UUID of the enrollment' },
          allowInstallments: { type: 'boolean', description: 'Allow payment in installments' },
          maxInstallments: { type: 'number', description: 'Maximum number of installments' },
        },
        required: ['personId', 'amount', 'description'],
      },
    },
    {
      name: 'create_calendar_event',
      description: 'Create a Google Calendar event with attendees. Currently returns a stub - Google Calendar integration coming soon.',
      input_schema: {
        type: 'object' as const,
        properties: {
          title: { type: 'string', description: 'Calendar event title' },
          description: { type: 'string', description: 'Event description' },
          startTime: { type: 'string', description: 'ISO 8601 start datetime' },
          endTime: { type: 'string', description: 'ISO 8601 end datetime' },
          location: { type: 'string', description: 'Event location' },
          attendeeEmails: { type: 'array', items: { type: 'string' }, description: 'Email addresses to invite' },
          attendeePersonIds: { type: 'array', items: { type: 'string' }, description: 'Person IDs to invite' },
        },
        required: ['title', 'startTime', 'endTime'],
      },
    },
    {
      name: 'upload_file',
      description: 'Upload a file to storage. Currently returns a stub - Supabase Storage integration coming soon.',
      input_schema: {
        type: 'object' as const,
        properties: {
          fileName: { type: 'string', description: 'Name for the uploaded file' },
          fileType: { type: 'string', description: 'MIME type (application/pdf, image/jpeg, etc.)' },
          folder: { type: 'string', description: 'Folder path in storage' },
          personId: { type: 'string', description: 'Associate file with a person' },
          description: { type: 'string', description: 'File description' },
        },
        required: ['fileName', 'fileType'],
      },
    },
    {
      name: 'escalate_to_human',
      description: 'Flag a situation for human review. Use this when you cannot handle something, need approval, or encounter sensitive situations.',
      input_schema: {
        type: 'object' as const,
        properties: {
          reason: { type: 'string', description: 'Why this needs human attention' },
          urgency: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], description: 'Urgency level' },
          personId: { type: 'string', description: 'Related person ID' },
          enrollmentId: { type: 'string', description: 'Related enrollment ID' },
          interviewId: { type: 'string', description: 'Related interview ID' },
          context: {
            type: 'object',
            properties: {
              lastMessage: { type: 'string' },
              conversationSummary: { type: 'string' },
              actionsTaken: { type: 'array', items: { type: 'string' } },
              suggestedActions: { type: 'array', items: { type: 'string' } },
            },
            description: 'Additional context for the reviewer',
          },
          assignTo: { type: 'string', description: 'Specific staff member UUID to assign to' },
        },
        required: ['reason'],
      },
    },
    {
      name: 'calculate_engagement_score',
      description: 'Calculate engagement score for a person based on their activity: events attended, communications, payments, program participation.',
      input_schema: {
        type: 'object' as const,
        properties: {
          personId: { type: 'string', description: 'UUID of the person to calculate score for' },
        },
        required: ['personId'],
      },
    },
  ];
}

// ============================================================================
// Tool Handlers (actual database operations)
// ============================================================================

async function handleSearchPeople(input: SearchPeopleInput, organizationId: string) {
  const { query, status, limit = 20 } = input;

  console.log(`[SEARCH] handleSearchPeople called with:`, { query, status, limit, organizationId });

  const conditions = [eq(people.organizationId, organizationId)];

  if (status) {
    conditions.push(eq(people.status, status));
  }

  if (query) {
    const searchPattern = `%${query}%`;

    // Build search conditions - match the full query against each field
    const searchConditions = [
      ilike(people.firstName, searchPattern),
      ilike(people.lastName, searchPattern),
      ilike(people.email, searchPattern),
      ilike(people.phone, searchPattern),
      // Also try to match firstName + lastName concatenated (for full name searches)
      sql`(${people.firstName} || ' ' || ${people.lastName}) ILIKE ${searchPattern}`,
    ];

    // If query has multiple words (space-separated), also try matching each part
    const queryParts = query.trim().split(/\s+/);
    if (queryParts.length >= 2) {
      // Try first part as firstName and second part as lastName
      const firstPart = `%${queryParts[0]}%`;
      const secondPart = `%${queryParts.slice(1).join(' ')}%`;
      searchConditions.push(
        and(
          ilike(people.firstName, firstPart),
          ilike(people.lastName, secondPart)
        )!
      );
      // Also try reverse (lastName firstName order)
      searchConditions.push(
        and(
          ilike(people.lastName, firstPart),
          ilike(people.firstName, secondPart)
        )!
      );
    }

    conditions.push(or(...searchConditions)!);
  }

  const results = await db
    .select()
    .from(people)
    .where(and(...conditions))
    .limit(limit);

  console.log(`[SEARCH] Results found: ${results.length}`, results.map(p => ({ id: p.id, firstName: p.firstName, lastName: p.lastName })));

  return {
    count: results.length,
    people: results.map((p: typeof people.$inferSelect) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      email: p.email,
      phone: p.phone,
      status: p.status,
      tags: p.tags,
      createdAt: p.createdAt,
    })),
  };
}

async function handleGetPerson(input: GetPersonInput, organizationId: string) {
  const { personId } = input;

  const result = await db
    .select()
    .from(people)
    .where(and(eq(people.id, personId), eq(people.organizationId, organizationId)))
    .limit(1);

  if (result.length === 0) {
    return { error: 'Person not found', personId };
  }

  return {
    person: result[0],
  };
}

async function handleCreatePerson(input: CreatePersonInput, organizationId: string) {
  const { firstName, lastName, email, phone, status = 'pending', metadata, tags } = input;

  const result = await db
    .insert(people)
    .values({
      organizationId,
      firstName,
      lastName,
      email,
      phone,
      status,
      metadata: metadata || {},
      tags: tags || [],
    })
    .returning();

  return {
    success: true,
    message: `Created person: ${firstName} ${lastName}`,
    person: result[0],
  };
}

async function handleUpdatePerson(input: UpdatePersonInput, organizationId: string) {
  const { personId, ...updates } = input;

  // Filter out undefined values
  const updateData: Record<string, unknown> = {};
  if (updates.firstName !== undefined) updateData.firstName = updates.firstName;
  if (updates.lastName !== undefined) updateData.lastName = updates.lastName;
  if (updates.email !== undefined) updateData.email = updates.email;
  if (updates.phone !== undefined) updateData.phone = updates.phone;
  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.metadata !== undefined) updateData.metadata = updates.metadata;
  if (updates.tags !== undefined) updateData.tags = updates.tags;

  // Always update the updatedAt timestamp
  updateData.updatedAt = new Date();

  const result = await db
    .update(people)
    .set(updateData)
    .where(and(eq(people.id, personId), eq(people.organizationId, organizationId)))
    .returning();

  if (result.length === 0) {
    return { error: 'Person not found or not in your organization', personId };
  }

  return {
    success: true,
    message: `Updated person: ${result[0].firstName} ${result[0].lastName}`,
    person: result[0],
  };
}

async function handleListPrograms(input: ListProgramsInput, organizationId: string) {
  const { type, isActive, limit = 20 } = input;

  const conditions = [eq(programs.organizationId, organizationId)];

  if (type) {
    conditions.push(eq(programs.type, type));
  }

  if (isActive !== undefined) {
    conditions.push(eq(programs.isActive, isActive));
  }

  const results = await db
    .select()
    .from(programs)
    .where(and(...conditions))
    .limit(limit);

  return {
    count: results.length,
    programs: results.map((p: typeof programs.$inferSelect) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      type: p.type,
      isActive: p.isActive,
      config: p.config,
      createdAt: p.createdAt,
    })),
  };
}

async function handleGetProgram(input: GetProgramInput, organizationId: string) {
  const { programId } = input;

  const result = await db
    .select()
    .from(programs)
    .where(and(eq(programs.id, programId), eq(programs.organizationId, organizationId)))
    .limit(1);

  if (result.length === 0) {
    return { error: 'Program not found', programId };
  }

  return {
    program: result[0],
  };
}

async function handleScheduleInterview(input: ScheduleInterviewInput, organizationId: string) {
  const { personId, programId, scheduledAt, durationMinutes = '30', location, enrollmentId } = input;

  // Verify person exists
  const personResult = await db
    .select()
    .from(people)
    .where(and(eq(people.id, personId), eq(people.organizationId, organizationId)))
    .limit(1);

  if (personResult.length === 0) {
    return { error: 'Person not found', personId };
  }

  // Verify program exists
  const programResult = await db
    .select()
    .from(programs)
    .where(and(eq(programs.id, programId), eq(programs.organizationId, organizationId)))
    .limit(1);

  if (programResult.length === 0) {
    return { error: 'Program not found', programId };
  }

  // Create the interview
  const result = await db
    .insert(interviews)
    .values({
      organizationId,
      personId,
      programId,
      enrollmentId: enrollmentId || null,
      scheduledAt: new Date(scheduledAt),
      durationMinutes,
      location,
      status: 'scheduled',
    })
    .returning();

  const person = personResult[0];
  const program = programResult[0];

  return {
    success: true,
    message: `Interview scheduled for ${person.firstName} ${person.lastName} for ${program.name}`,
    interview: {
      id: result[0].id,
      scheduledAt: result[0].scheduledAt,
      durationMinutes: result[0].durationMinutes,
      location: result[0].location,
      status: result[0].status,
      person: {
        id: person.id,
        firstName: person.firstName,
        lastName: person.lastName,
        email: person.email,
      },
      program: {
        id: program.id,
        name: program.name,
      },
    },
  };
}

async function handleRecordInterviewOutcome(input: RecordInterviewOutcomeInput, organizationId: string) {
  const { interviewId, outcome, notes, score, strengths, concerns, recommendation } = input;

  // Verify interview exists and belongs to organization
  const interviewResult = await db
    .select()
    .from(interviews)
    .where(and(eq(interviews.id, interviewId), eq(interviews.organizationId, organizationId)))
    .limit(1);

  if (interviewResult.length === 0) {
    return { error: 'Interview not found', interviewId };
  }

  // Build interviewer notes object
  const interviewerNotes: {
    strengths?: string[];
    concerns?: string[];
    recommendation?: string;
    score?: number;
  } = {};

  if (strengths) interviewerNotes.strengths = strengths;
  if (concerns) interviewerNotes.concerns = concerns;
  if (recommendation) interviewerNotes.recommendation = recommendation;
  if (score !== undefined) interviewerNotes.score = score;

  // Update the interview
  const result = await db
    .update(interviews)
    .set({
      status: 'completed',
      outcome,
      notes,
      interviewerNotes: Object.keys(interviewerNotes).length > 0 ? interviewerNotes : null,
      updatedAt: new Date(),
    })
    .where(and(eq(interviews.id, interviewId), eq(interviews.organizationId, organizationId)))
    .returning();

  return {
    success: true,
    message: `Interview outcome recorded: ${outcome}`,
    interview: result[0],
  };
}

async function handleListInterviews(input: ListInterviewsInput, organizationId: string) {
  const { personId, programId, status, fromDate, toDate, limit = 20 } = input;

  const conditions = [eq(interviews.organizationId, organizationId)];

  if (personId) {
    conditions.push(eq(interviews.personId, personId));
  }

  if (programId) {
    conditions.push(eq(interviews.programId, programId));
  }

  if (status) {
    conditions.push(eq(interviews.status, status));
  }

  if (fromDate) {
    conditions.push(gte(interviews.scheduledAt, new Date(fromDate)));
  }

  if (toDate) {
    conditions.push(lte(interviews.scheduledAt, new Date(toDate)));
  }

  const results = await db
    .select()
    .from(interviews)
    .where(and(...conditions))
    .limit(limit);

  return {
    count: results.length,
    interviews: results,
  };
}

async function handleCreateEnrollment(input: CreateEnrollmentInput, organizationId: string) {
  const { personId, programId, cohortId, applicationData, status = 'applied' } = input;

  // Verify person exists
  const personResult = await db
    .select()
    .from(people)
    .where(and(eq(people.id, personId), eq(people.organizationId, organizationId)))
    .limit(1);

  if (personResult.length === 0) {
    return { error: 'Person not found', personId };
  }

  // Verify program exists
  const programResult = await db
    .select()
    .from(programs)
    .where(and(eq(programs.id, programId), eq(programs.organizationId, organizationId)))
    .limit(1);

  if (programResult.length === 0) {
    return { error: 'Program not found', programId };
  }

  // Create enrollment
  const result = await db
    .insert(enrollments)
    .values({
      organizationId,
      personId,
      programId,
      cohortId: cohortId || null,
      applicationData: applicationData || {},
      status,
      appliedAt: new Date(),
    })
    .returning();

  const person = personResult[0];
  const program = programResult[0];

  return {
    success: true,
    message: `Enrollment created for ${person.firstName} ${person.lastName} in ${program.name}`,
    enrollment: result[0],
  };
}

async function handleUpdateEnrollmentStatus(input: UpdateEnrollmentStatusInput, organizationId: string) {
  const { enrollmentId, status } = input;

  // Verify enrollment exists and belongs to organization
  const enrollmentResult = await db
    .select()
    .from(enrollments)
    .where(and(eq(enrollments.id, enrollmentId), eq(enrollments.organizationId, organizationId)))
    .limit(1);

  if (enrollmentResult.length === 0) {
    return { error: 'Enrollment not found', enrollmentId };
  }

  // Build update data
  const updateData: Record<string, unknown> = {
    status,
    updatedAt: new Date(),
  };

  // Set timestamp fields based on status
  if (status === 'enrolled') {
    updateData.enrolledAt = new Date();
  } else if (status === 'completed') {
    updateData.completedAt = new Date();
  }

  const result = await db
    .update(enrollments)
    .set(updateData)
    .where(and(eq(enrollments.id, enrollmentId), eq(enrollments.organizationId, organizationId)))
    .returning();

  return {
    success: true,
    message: `Enrollment status updated to: ${status}`,
    enrollment: result[0],
  };
}

async function handleSendMessage(input: SendMessageInput, organizationId: string) {
  const { personId, channel, subject, message, templateId } = input;

  // Verify person exists
  const personResult = await db
    .select()
    .from(people)
    .where(and(eq(people.id, personId), eq(people.organizationId, organizationId)))
    .limit(1);

  if (personResult.length === 0) {
    return { error: 'Person not found', personId };
  }

  const person = personResult[0];

  // Handle email channel with Brevo
  if (channel === 'email') {
    if (!person.email) {
      return {
        success: false,
        message: 'Cannot send email: person has no email address',
        personId,
      };
    }

    // Build email content - check for template
    let emailSubject = subject || 'הודעה מ-HKF';
    let htmlContent = `<div dir="rtl" style="font-family: Arial, sans-serif;">${message.replace(/\n/g, '<br>')}</div>`;
    let textContent = message;

    // Handle predefined templates
    if (templateId) {
      const templateName = templateId as keyof typeof emailTemplates;
      if (templateName in emailTemplates) {
        // Parse template parameters from message (JSON format expected)
        try {
          const params = JSON.parse(message);
          const template = (emailTemplates[templateName] as Function)(params);
          emailSubject = template.subject;
          htmlContent = template.htmlContent;
          textContent = template.textContent;
        } catch {
          // If message is not JSON, use it as custom message in template
          console.log(`[Email] Using templateId ${templateId} with plain message`);
        }
      }
    }

    // Send via Brevo
    const emailResult = await sendEmail({
      to: [{ email: person.email, name: `${person.firstName} ${person.lastName}` }],
      subject: emailSubject,
      htmlContent,
      textContent,
      tags: ['crm', 'jarvis'],
    });

    // Log communication
    await db
      .insert(communications)
      .values({
        organizationId,
        personId: person.id,
        channel: 'email',
        direction: 'outbound',
        subject: emailSubject,
        message: textContent,
        status: emailResult.success ? 'sent' : 'failed',
        externalId: emailResult.messageId || null,
      });

    if (emailResult.success) {
      return {
        success: true,
        message: `Email sent to ${person.firstName} ${person.lastName}`,
        details: {
          channel: 'email',
          recipient: {
            id: person.id,
            name: `${person.firstName} ${person.lastName}`,
            email: person.email,
          },
          subject: emailSubject,
          messageId: emailResult.messageId,
          status: 'sent',
        },
      };
    } else {
      return {
        success: false,
        message: emailResult.message,
        error: emailResult.error,
        details: {
          channel: 'email',
          recipient: {
            id: person.id,
            name: `${person.firstName} ${person.lastName}`,
            email: person.email,
          },
          status: 'failed',
        },
      };
    }
  }

  // Handle WhatsApp and SMS channels (still stub - pending Naama Bot integration)
  return {
    success: true,
    message: `Message queued for delivery via ${channel}`,
    details: {
      channel,
      recipient: {
        id: person.id,
        name: `${person.firstName} ${person.lastName}`,
        email: person.email,
        phone: person.phone,
      },
      subject: subject || null,
      messagePreview: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
      status: 'pending_integration',
      note: `${channel === 'whatsapp' ? 'Naama Bot' : 'SMS'} adapter not yet configured. Message logged but not sent.`,
    },
  };
}

async function handleRecordPayment(input: RecordPaymentInput, organizationId: string) {
  const {
    personId,
    amount,
    currency = 'ILS',
    description,
    programId,
    enrollmentId,
    status = 'completed',
    provider,
    externalId,
    paymentMethod,
  } = input;

  // Verify person exists
  const personResult = await db
    .select()
    .from(people)
    .where(and(eq(people.id, personId), eq(people.organizationId, organizationId)))
    .limit(1);

  if (personResult.length === 0) {
    return { error: 'Person not found', personId };
  }

  // Verify program if provided
  if (programId) {
    const programResult = await db
      .select()
      .from(programs)
      .where(and(eq(programs.id, programId), eq(programs.organizationId, organizationId)))
      .limit(1);

    if (programResult.length === 0) {
      return { error: 'Program not found', programId };
    }
  }

  // Verify enrollment if provided
  if (enrollmentId) {
    const enrollmentResult = await db
      .select()
      .from(enrollments)
      .where(and(eq(enrollments.id, enrollmentId), eq(enrollments.organizationId, organizationId)))
      .limit(1);

    if (enrollmentResult.length === 0) {
      return { error: 'Enrollment not found', enrollmentId };
    }
  }

  // Create payment record
  const result = await db
    .insert(payments)
    .values({
      organizationId,
      personId,
      programId: programId || null,
      enrollmentId: enrollmentId || null,
      amount,
      currency,
      description,
      status,
      provider,
      externalId,
      paymentMethod,
      paidAt: status === 'completed' ? new Date() : null,
    })
    .returning();

  const person = personResult[0];
  const formattedAmount = (amount / 100).toFixed(2);

  return {
    success: true,
    message: `Payment of ${formattedAmount} ${currency} recorded for ${person.firstName} ${person.lastName}`,
    payment: result[0],
  };
}

async function handleListPayments(input: ListPaymentsInput, organizationId: string) {
  const { personId, programId, enrollmentId, status, limit = 20 } = input;

  const conditions = [eq(payments.organizationId, organizationId)];

  if (personId) {
    conditions.push(eq(payments.personId, personId));
  }

  if (programId) {
    conditions.push(eq(payments.programId, programId));
  }

  if (enrollmentId) {
    conditions.push(eq(payments.enrollmentId, enrollmentId));
  }

  if (status) {
    conditions.push(eq(payments.status, status));
  }

  const results = await db
    .select()
    .from(payments)
    .where(and(...conditions))
    .limit(limit);

  return {
    count: results.length,
    payments: results,
  };
}

async function handleListEnrollments(input: ListEnrollmentsInput, organizationId: string) {
  const { personId, programId, status, limit = 20 } = input;

  const conditions = [eq(enrollments.organizationId, organizationId)];

  if (personId) {
    conditions.push(eq(enrollments.personId, personId));
  }

  if (programId) {
    conditions.push(eq(enrollments.programId, programId));
  }

  if (status) {
    conditions.push(eq(enrollments.status, status));
  }

  const results = await db
    .select()
    .from(enrollments)
    .where(and(...conditions))
    .limit(limit);

  return {
    count: results.length,
    enrollments: results,
  };
}

async function handleGetInterview(input: GetInterviewInput, organizationId: string) {
  const { interviewId } = input;

  // Get interview with person and program details
  const interviewResult = await db
    .select()
    .from(interviews)
    .where(and(eq(interviews.id, interviewId), eq(interviews.organizationId, organizationId)))
    .limit(1);

  if (interviewResult.length === 0) {
    return { error: 'Interview not found', interviewId };
  }

  const interview = interviewResult[0];

  // Get person details
  const personResult = await db
    .select()
    .from(people)
    .where(eq(people.id, interview.personId))
    .limit(1);

  // Get program details
  const programResult = await db
    .select()
    .from(programs)
    .where(eq(programs.id, interview.programId))
    .limit(1);

  return {
    interview: {
      ...interview,
      person: personResult[0] || null,
      program: programResult[0] || null,
    },
  };
}

// ============================================================================
// NEW TOOL HANDLERS (9 additional tools)
// ============================================================================

async function handleSendBulkMessage(input: SendBulkMessageInput, organizationId: string) {
  const { channel, audienceFilter, subject, message } = input;

  // Build query conditions based on audience filter
  const conditions = [eq(people.organizationId, organizationId)];

  if (audienceFilter.statuses && audienceFilter.statuses.length > 0) {
    // Filter by any of the specified statuses
    conditions.push(
      or(...audienceFilter.statuses.map(s => eq(people.status, s as 'active' | 'inactive' | 'pending' | 'archived')))!
    );
  }

  if (audienceFilter.tags && audienceFilter.tags.length > 0) {
    // Filter by tags (person must have at least one of the tags)
    // Using SQL array overlap operator
    conditions.push(
      sql`${people.tags} && ARRAY[${sql.join(audienceFilter.tags.map(t => sql`${t}`), sql`, `)}]::text[]`
    );
  }

  // Get matching people
  let recipients = await db
    .select()
    .from(people)
    .where(and(...conditions))
    .limit(1000); // Safety limit

  // If program filter specified, filter by enrollment
  if (audienceFilter.programIds && audienceFilter.programIds.length > 0) {
    const enrolledPeople = await db
      .select({ personId: enrollments.personId })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.organizationId, organizationId),
          or(...audienceFilter.programIds.map(pid => eq(enrollments.programId, pid)))!
        )
      );

    const enrolledIds = new Set(enrolledPeople.map(e => e.personId));
    recipients = recipients.filter(p => enrolledIds.has(p.id));
  }

  // Handle email channel with Brevo
  if (channel === 'email') {
    // Filter recipients with valid emails
    const emailRecipients = recipients.filter(p => p.email);

    if (emailRecipients.length === 0) {
      return {
        success: false,
        message: 'No recipients with valid email addresses found',
        recipientCount: 0,
      };
    }

    // Build HTML content with RTL support
    const htmlTemplate = `<div dir="rtl" style="font-family: Arial, sans-serif;">${message.replace(/\n/g, '<br>')}</div>`;

    // Use the bulk email function
    const bulkResult = await sendBulkEmail(
      emailRecipients.map(p => ({
        email: p.email!,
        name: `${p.firstName} ${p.lastName}`,
        params: {
          first_name: p.firstName,
          last_name: p.lastName,
        },
      })),
      subject || 'הודעה מ-HKF',
      htmlTemplate,
      { tags: ['crm', 'jarvis', 'bulk'] }
    );

    // Log communications
    const communicationLogs = [];
    for (const person of emailRecipients) {
      const personalizedMessage = message
        .replace(/\{\{first_name\}\}/g, person.firstName)
        .replace(/\{\{last_name\}\}/g, person.lastName);

      const log = await db
        .insert(communications)
        .values({
          organizationId,
          personId: person.id,
          channel: 'email',
          direction: 'outbound',
          subject: subject || null,
          message: personalizedMessage,
          status: bulkResult.success ? 'sent' : 'failed',
        })
        .returning();

      communicationLogs.push({
        personId: person.id,
        name: `${person.firstName} ${person.lastName}`,
        email: person.email,
        communicationId: log[0].id,
      });
    }

    return {
      success: bulkResult.success,
      message: bulkResult.message,
      recipientCount: emailRecipients.length,
      communications: communicationLogs.slice(0, 10), // Return first 10 for preview
      error: bulkResult.error,
    };
  }

  // For WhatsApp and SMS channels (still stub - pending integration)
  const communicationLogs = [];
  for (const person of recipients) {
    // Personalize message
    const personalizedMessage = message
      .replace(/\{\{first_name\}\}/g, person.firstName)
      .replace(/\{\{last_name\}\}/g, person.lastName);

    // Insert communication log
    const log = await db
      .insert(communications)
      .values({
        organizationId,
        personId: person.id,
        channel,
        direction: 'outbound',
        subject: subject || null,
        message: personalizedMessage,
        status: 'queued',
      })
      .returning();

    communicationLogs.push({
      personId: person.id,
      name: `${person.firstName} ${person.lastName}`,
      communicationId: log[0].id,
    });
  }

  return {
    success: true,
    message: `Bulk message queued for ${recipients.length} recipients via ${channel}`,
    recipientCount: recipients.length,
    communications: communicationLogs.slice(0, 10), // Return first 10 for preview
    note: `${channel === 'whatsapp' ? 'Naama Bot' : 'SMS'} adapter not yet configured. Messages logged but not sent.`,
  };
}

async function handleCreateEvent(input: CreateEventInput, organizationId: string) {
  const { name, description, type, startsAt, endsAt, location, locationUrl, capacity, targetAudience } = input;

  const result = await db
    .insert(events)
    .values({
      organizationId,
      name,
      description,
      type,
      startsAt: new Date(startsAt),
      endsAt: endsAt ? new Date(endsAt) : null,
      location,
      locationUrl,
      capacity,
      targetAudience: targetAudience || {},
      status: 'draft',
    })
    .returning();

  return {
    success: true,
    message: `Event "${name}" created`,
    event: result[0],
  };
}

async function handleRegisterForEvent(input: RegisterForEventInput, organizationId: string) {
  const { eventId, personId, guests = 0, notes } = input;

  // Verify event exists
  const eventResult = await db
    .select()
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.organizationId, organizationId)))
    .limit(1);

  if (eventResult.length === 0) {
    return { error: 'Event not found', eventId };
  }

  const event = eventResult[0];

  // Verify person exists
  const personResult = await db
    .select()
    .from(people)
    .where(and(eq(people.id, personId), eq(people.organizationId, organizationId)))
    .limit(1);

  if (personResult.length === 0) {
    return { error: 'Person not found', personId };
  }

  const person = personResult[0];

  // Check if already registered
  const existingReg = await db
    .select()
    .from(eventRegistrations)
    .where(
      and(
        eq(eventRegistrations.eventId, eventId),
        eq(eventRegistrations.personId, personId)
      )
    )
    .limit(1);

  if (existingReg.length > 0) {
    return { error: 'Person already registered for this event', registrationId: existingReg[0].id };
  }

  // Check capacity
  let status: 'registered' | 'waitlisted' = 'registered';
  if (event.capacity && event.registrationCount !== null && event.registrationCount >= event.capacity) {
    status = 'waitlisted';
  }

  // Create registration
  const result = await db
    .insert(eventRegistrations)
    .values({
      organizationId,
      eventId,
      personId,
      status,
      guests,
      notes,
    })
    .returning();

  // Update registration count
  await db
    .update(events)
    .set({
      registrationCount: sql`${events.registrationCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(events.id, eventId));

  return {
    success: true,
    message: status === 'waitlisted'
      ? `${person.firstName} ${person.lastName} added to waitlist for "${event.name}"`
      : `${person.firstName} ${person.lastName} registered for "${event.name}"`,
    registration: result[0],
  };
}

async function handleCheckInEvent(input: CheckInEventInput, organizationId: string) {
  const { eventId, personId } = input;

  // Find the registration
  const regResult = await db
    .select()
    .from(eventRegistrations)
    .where(
      and(
        eq(eventRegistrations.eventId, eventId),
        eq(eventRegistrations.personId, personId),
        eq(eventRegistrations.organizationId, organizationId)
      )
    )
    .limit(1);

  if (regResult.length === 0) {
    return { error: 'Registration not found for this person and event', eventId, personId };
  }

  const registration = regResult[0];

  if (registration.checkedInAt) {
    return {
      error: 'Person already checked in',
      checkedInAt: registration.checkedInAt
    };
  }

  // Update registration with check-in
  const result = await db
    .update(eventRegistrations)
    .set({
      status: 'attended',
      checkedInAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(eventRegistrations.id, registration.id))
    .returning();

  // Get person name for response
  const personResult = await db
    .select()
    .from(people)
    .where(eq(people.id, personId))
    .limit(1);

  const person = personResult[0];

  return {
    success: true,
    message: `${person?.firstName} ${person?.lastName} checked in`,
    registration: result[0],
  };
}

async function handleCreatePaymentLink(input: CreatePaymentLinkInput, organizationId: string) {
  const { personId, amount, currency = 'ILS', description, programId, enrollmentId, allowInstallments, maxInstallments } = input;

  // Verify person exists
  const personResult = await db
    .select()
    .from(people)
    .where(and(eq(people.id, personId), eq(people.organizationId, organizationId)))
    .limit(1);

  if (personResult.length === 0) {
    return { error: 'Person not found', personId };
  }

  const person = personResult[0];
  const formattedAmount = (amount / 100).toFixed(2);

  // TODO: Integrate with Meshulam API to generate actual payment link
  // For now, return a stub response
  return {
    success: true,
    message: `Payment link generated for ${person.firstName} ${person.lastName}`,
    paymentLink: {
      url: `https://meshulam.example.com/pay/${organizationId}/${personId}?amount=${amount}`,
      amount,
      formattedAmount: `${formattedAmount} ${currency}`,
      currency,
      description,
      personId,
      programId: programId || null,
      enrollmentId: enrollmentId || null,
      allowInstallments: allowInstallments || false,
      maxInstallments: maxInstallments || 1,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      status: 'pending_integration',
      note: 'Meshulam adapter not yet configured. This is a placeholder link.',
    },
  };
}

async function handleCreateCalendarEvent(input: CreateCalendarEventInput, organizationId: string) {
  const { title, description, startTime, endTime, location, attendeeEmails = [], attendeePersonIds = [] } = input;

  // Lookup emails for person IDs
  const additionalEmails: string[] = [];
  if (attendeePersonIds.length > 0) {
    const peopleResult = await db
      .select({ email: people.email })
      .from(people)
      .where(
        and(
          eq(people.organizationId, organizationId),
          or(...attendeePersonIds.map(pid => eq(people.id, pid)))!
        )
      );

    additionalEmails.push(...peopleResult.filter(p => p.email).map(p => p.email!));
  }

  const allAttendees = [...new Set([...attendeeEmails, ...additionalEmails])];

  // Use the Google Calendar integration
  const calendarResult = await googleCreateCalendarEvent({
    title,
    description,
    startTime,
    endTime,
    location,
    attendeeEmails: allAttendees,
    sendNotifications: true,
  });

  if (calendarResult.success) {
    return {
      success: true,
      message: calendarResult.message,
      calendarEvent: {
        id: calendarResult.eventId || `cal_${Date.now()}`,
        title,
        description: description || null,
        startTime,
        endTime,
        location: location || null,
        attendees: allAttendees,
        link: calendarResult.eventLink,
        status: 'created',
      },
    };
  } else {
    // Calendar not configured - provide helpful feedback
    return {
      success: false,
      message: calendarResult.message,
      error: calendarResult.error,
      calendarEvent: {
        id: `cal_pending_${Date.now()}`,
        title,
        description: description || null,
        startTime,
        endTime,
        location: location || null,
        attendees: allAttendees,
        status: 'pending_configuration',
        note: 'Calendar event logged but not synced. Configure GOOGLE_SERVICE_ACCOUNT_KEY to enable Google Calendar sync.',
      },
    };
  }
}

async function handleUploadFile(input: UploadFileInput, organizationId: string) {
  const { fileName, fileType, folder = '/uploads', personId, description } = input;

  // TODO: Integrate with Supabase Storage
  // For now, return a stub response with a placeholder URL
  const fileId = `file_${Date.now()}`;
  const filePath = `${organizationId}${folder}/${fileId}_${fileName}`;

  return {
    success: true,
    message: `File "${fileName}" upload prepared`,
    file: {
      id: fileId,
      fileName,
      fileType,
      filePath,
      url: `https://storage.example.com/${filePath}`,
      folder,
      personId: personId || null,
      description: description || null,
      status: 'pending_integration',
      note: 'Supabase Storage adapter not yet configured. Use the returned upload URL to upload file content.',
      uploadUrl: `https://api.example.com/upload/${fileId}`,
    },
  };
}

async function handleEscalateToHuman(input: EscalateToHumanInput, organizationId: string) {
  const { reason, urgency = 'medium', personId, enrollmentId, interviewId, context, assignTo } = input;

  // Create escalation record
  const result = await db
    .insert(escalations)
    .values({
      organizationId,
      reason,
      urgency,
      personId: personId || null,
      enrollmentId: enrollmentId || null,
      interviewId: interviewId || null,
      context: context || {},
      assignedTo: assignTo || null,
      assignedAt: assignTo ? new Date() : null,
      status: 'open',
      source: 'ai_agent',
    })
    .returning();

  // Get person details if personId provided
  let personName = null;
  if (personId) {
    const personResult = await db
      .select()
      .from(people)
      .where(eq(people.id, personId))
      .limit(1);

    if (personResult.length > 0) {
      personName = `${personResult[0].firstName} ${personResult[0].lastName}`;
    }
  }

  return {
    success: true,
    message: `Escalation created: ${reason}`,
    escalation: {
      id: result[0].id,
      reason,
      urgency,
      status: 'open',
      personName,
      createdAt: result[0].createdAt,
    },
    note: 'This situation has been flagged for human review. A staff member will handle it.',
  };
}

async function handleCalculateEngagementScore(input: CalculateEngagementScoreInput, organizationId: string) {
  const { personId } = input;

  // Verify person exists
  const personResult = await db
    .select()
    .from(people)
    .where(and(eq(people.id, personId), eq(people.organizationId, organizationId)))
    .limit(1);

  if (personResult.length === 0) {
    return { error: 'Person not found', personId };
  }

  const person = personResult[0];

  // Count enrollments
  const enrollmentCount = await db
    .select({ count: count() })
    .from(enrollments)
    .where(and(eq(enrollments.personId, personId), eq(enrollments.organizationId, organizationId)));

  // Count completed enrollments
  const completedCount = await db
    .select({ count: count() })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.personId, personId),
        eq(enrollments.organizationId, organizationId),
        eq(enrollments.status, 'completed')
      )
    );

  // Count payments
  const paymentCount = await db
    .select({ count: count() })
    .from(payments)
    .where(
      and(
        eq(payments.personId, personId),
        eq(payments.organizationId, organizationId),
        eq(payments.status, 'completed')
      )
    );

  // Count event attendances
  const eventCount = await db
    .select({ count: count() })
    .from(eventRegistrations)
    .where(
      and(
        eq(eventRegistrations.personId, personId),
        eq(eventRegistrations.organizationId, organizationId),
        eq(eventRegistrations.status, 'attended')
      )
    );

  // Calculate score (simple weighted formula)
  const scores = {
    enrollments: Number(enrollmentCount[0]?.count || 0) * 10,
    completions: Number(completedCount[0]?.count || 0) * 20,
    payments: Number(paymentCount[0]?.count || 0) * 15,
    events: Number(eventCount[0]?.count || 0) * 5,
  };

  const totalScore = scores.enrollments + scores.completions + scores.payments + scores.events;

  // Determine engagement level
  let level: 'low' | 'medium' | 'high' | 'champion';
  if (totalScore >= 100) level = 'champion';
  else if (totalScore >= 50) level = 'high';
  else if (totalScore >= 20) level = 'medium';
  else level = 'low';

  return {
    success: true,
    person: {
      id: person.id,
      name: `${person.firstName} ${person.lastName}`,
    },
    engagementScore: {
      total: totalScore,
      level,
      breakdown: scores,
      metrics: {
        totalEnrollments: Number(enrollmentCount[0]?.count || 0),
        completedPrograms: Number(completedCount[0]?.count || 0),
        paymentsCompleted: Number(paymentCount[0]?.count || 0),
        eventsAttended: Number(eventCount[0]?.count || 0),
      },
    },
    calculatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Tool Execution Router
// ============================================================================

export type ToolName =
  | 'search_people'
  | 'get_person'
  | 'create_person'
  | 'update_person'
  | 'list_programs'
  | 'get_program'
  | 'schedule_interview'
  | 'record_interview_outcome'
  | 'list_interviews'
  | 'create_enrollment'
  | 'update_enrollment_status'
  | 'send_message'
  | 'record_payment'
  | 'list_payments'
  | 'list_enrollments'
  | 'get_interview'
  // New tools
  | 'send_bulk_message'
  | 'create_event'
  | 'register_for_event'
  | 'check_in_event'
  | 'create_payment_link'
  | 'create_calendar_event'
  | 'upload_file'
  | 'escalate_to_human'
  | 'calculate_engagement_score';

export async function executeToolCall(
  toolName: ToolName,
  input: Record<string, unknown>,
  organizationId: string
): Promise<unknown> {
  switch (toolName) {
    case 'search_people': {
      const validated = searchPeopleSchema.parse(input);
      return handleSearchPeople(validated, organizationId);
    }
    case 'get_person': {
      const validated = getPersonSchema.parse(input);
      return handleGetPerson(validated, organizationId);
    }
    case 'create_person': {
      const validated = createPersonSchema.parse(input);
      return handleCreatePerson(validated, organizationId);
    }
    case 'update_person': {
      const validated = updatePersonSchema.parse(input);
      return handleUpdatePerson(validated, organizationId);
    }
    case 'list_programs': {
      const validated = listProgramsSchema.parse(input);
      return handleListPrograms(validated, organizationId);
    }
    case 'get_program': {
      const validated = getProgramSchema.parse(input);
      return handleGetProgram(validated, organizationId);
    }
    case 'schedule_interview': {
      const validated = scheduleInterviewSchema.parse(input);
      return handleScheduleInterview(validated, organizationId);
    }
    case 'record_interview_outcome': {
      const validated = recordInterviewOutcomeSchema.parse(input);
      return handleRecordInterviewOutcome(validated, organizationId);
    }
    case 'list_interviews': {
      const validated = listInterviewsSchema.parse(input);
      return handleListInterviews(validated, organizationId);
    }
    case 'create_enrollment': {
      const validated = createEnrollmentSchema.parse(input);
      return handleCreateEnrollment(validated, organizationId);
    }
    case 'update_enrollment_status': {
      const validated = updateEnrollmentStatusSchema.parse(input);
      return handleUpdateEnrollmentStatus(validated, organizationId);
    }
    case 'send_message': {
      const validated = sendMessageSchema.parse(input);
      return handleSendMessage(validated, organizationId);
    }
    case 'record_payment': {
      const validated = recordPaymentSchema.parse(input);
      return handleRecordPayment(validated, organizationId);
    }
    case 'list_payments': {
      const validated = listPaymentsSchema.parse(input);
      return handleListPayments(validated, organizationId);
    }
    case 'list_enrollments': {
      const validated = listEnrollmentsSchema.parse(input);
      return handleListEnrollments(validated, organizationId);
    }
    case 'get_interview': {
      const validated = getInterviewSchema.parse(input);
      return handleGetInterview(validated, organizationId);
    }
    // ========== NEW TOOLS ==========
    case 'send_bulk_message': {
      const validated = sendBulkMessageSchema.parse(input);
      return handleSendBulkMessage(validated, organizationId);
    }
    case 'create_event': {
      const validated = createEventSchema.parse(input);
      return handleCreateEvent(validated, organizationId);
    }
    case 'register_for_event': {
      const validated = registerForEventSchema.parse(input);
      return handleRegisterForEvent(validated, organizationId);
    }
    case 'check_in_event': {
      const validated = checkInEventSchema.parse(input);
      return handleCheckInEvent(validated, organizationId);
    }
    case 'create_payment_link': {
      const validated = createPaymentLinkSchema.parse(input);
      return handleCreatePaymentLink(validated, organizationId);
    }
    case 'create_calendar_event': {
      const validated = createCalendarEventSchema.parse(input);
      return handleCreateCalendarEvent(validated, organizationId);
    }
    case 'upload_file': {
      const validated = uploadFileSchema.parse(input);
      return handleUploadFile(validated, organizationId);
    }
    case 'escalate_to_human': {
      const validated = escalateToHumanSchema.parse(input);
      return handleEscalateToHuman(validated, organizationId);
    }
    case 'calculate_engagement_score': {
      const validated = calculateEngagementScoreSchema.parse(input);
      return handleCalculateEngagementScore(validated, organizationId);
    }
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
