// Export all schema definitions
export * from './organizations.js';
export * from './people.js';
export * from './programs.js';
export * from './interviews.js';
export * from './payments.js';

// Re-export for convenience
export { organizations } from './organizations.js';
export { people } from './people.js';
export { programs, cohorts, enrollments } from './programs.js';
export { interviews } from './interviews.js';
export { payments } from './payments.js';
