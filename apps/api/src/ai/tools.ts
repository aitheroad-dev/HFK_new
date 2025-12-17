import { z } from 'zod';

/**
 * AI Tool definitions for JARVIS
 * Based on the 18 tools from the AI Orchestration Specification
 * Each tool has a Zod schema for input validation
 */

// Tool schemas - will be expanded as per Document 03
export const searchPeopleSchema = z.object({
  query: z.string().describe('Search query for people'),
  filters: z.object({
    status: z.enum(['active', 'inactive', 'pending']).optional(),
    programId: z.string().uuid().optional(),
    cohortId: z.string().uuid().optional(),
  }).optional(),
  limit: z.number().default(20),
});

export const getPersonSchema = z.object({
  personId: z.string().uuid().describe('UUID of the person to retrieve'),
});

export const createPersonSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updatePersonSchema = z.object({
  personId: z.string().uuid(),
  updates: z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    status: z.enum(['active', 'inactive', 'pending']).optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
});

// Tool type definitions
export type SearchPeopleInput = z.infer<typeof searchPeopleSchema>;
export type GetPersonInput = z.infer<typeof getPersonSchema>;
export type CreatePersonInput = z.infer<typeof createPersonSchema>;
export type UpdatePersonInput = z.infer<typeof updatePersonSchema>;

// Tool registry - maps tool names to their handlers
export const toolRegistry = {
  search_people: {
    schema: searchPeopleSchema,
    description: 'Search for people in the CRM by name, email, or other criteria',
  },
  get_person: {
    schema: getPersonSchema,
    description: 'Get detailed information about a specific person',
  },
  create_person: {
    schema: createPersonSchema,
    description: 'Create a new person record in the CRM',
  },
  update_person: {
    schema: updatePersonSchema,
    description: 'Update an existing person record',
  },
  // More tools to be added as per Document 03:
  // - list_programs
  // - get_program
  // - schedule_interview
  // - record_interview_outcome
  // - create_payment_link
  // - check_payment_status
  // - send_message
  // - get_communication_history
  // - create_event
  // - register_for_event
  // - generate_report
  // - bulk_update
  // - search_across_all
  // - get_dashboard_stats
};
