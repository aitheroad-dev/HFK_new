// Export all schema definitions
export * from './organizations.js';
export * from './people.js';
export * from './programs.js';
export * from './interviews.js';
export * from './payments.js';
export * from './events.js';
export * from './escalations.js';

// Re-export for convenience
export { organizations } from './organizations.js';
export { people } from './people.js';
export { programs, cohorts, enrollments } from './programs.js';
export { interviews } from './interviews.js';
export { payments } from './payments.js';
export { events, eventRegistrations } from './events.js';
export { escalations, communications } from './escalations.js';
