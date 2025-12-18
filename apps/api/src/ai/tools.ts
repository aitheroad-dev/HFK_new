import { z } from 'zod';
import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import { db, people, programs, interviews, enrollments, payments } from '@generic-ai-crm/db';
import { eq, and, ilike, or, gte, lte } from 'drizzle-orm';

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
      description: 'Send a message to a person via email, WhatsApp, or SMS. Note: Currently returns a stub response - actual messaging integration coming soon.',
      input_schema: {
        type: 'object' as const,
        properties: {
          personId: {
            type: 'string',
            description: 'UUID of the person to message',
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
  ];
}

// ============================================================================
// Tool Handlers (actual database operations)
// ============================================================================

async function handleSearchPeople(input: SearchPeopleInput, organizationId: string) {
  const { query, status, limit = 20 } = input;

  const conditions = [eq(people.organizationId, organizationId)];

  if (status) {
    conditions.push(eq(people.status, status));
  }

  if (query) {
    const searchPattern = `%${query}%`;
    conditions.push(
      or(
        ilike(people.firstName, searchPattern),
        ilike(people.lastName, searchPattern),
        ilike(people.email, searchPattern),
        ilike(people.phone, searchPattern)
      )!
    );
  }

  const results = await db
    .select()
    .from(people)
    .where(and(...conditions))
    .limit(limit);

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
  const { personId, channel, subject, message } = input;

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

  // TODO: Implement actual messaging integration
  // For now, return a stub response
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
      note: 'Messaging adapter not yet configured. Message logged but not sent.',
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
  | 'get_interview';

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
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
