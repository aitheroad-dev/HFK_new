import { z } from 'zod';
import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import { db, people } from '@generic-ai-crm/db';
import { eq, and, ilike, or } from 'drizzle-orm';

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

// Type exports
export type SearchPeopleInput = z.infer<typeof searchPeopleSchema>;
export type GetPersonInput = z.infer<typeof getPersonSchema>;
export type CreatePersonInput = z.infer<typeof createPersonSchema>;
export type UpdatePersonInput = z.infer<typeof updatePersonSchema>;

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

// ============================================================================
// Tool Execution Router
// ============================================================================

export type ToolName = 'search_people' | 'get_person' | 'create_person' | 'update_person';

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
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
