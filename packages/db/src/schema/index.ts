// Export all schema definitions
export * from './organizations.js';
export * from './people.js';
export * from './programs.js';

// Re-export for convenience
export { organizations } from './organizations.js';
export { people } from './people.js';
export { programs, cohorts, enrollments } from './programs.js';
