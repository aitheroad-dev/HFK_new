import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

// Database connection
const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);

// Drizzle ORM instance with schema
export const db = drizzle(client, { schema });

// Export schema for use in other packages
export * from './schema/index.js';
export { schema };
