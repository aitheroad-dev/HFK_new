// Export all schema definitions
export * from './organizations';
export * from './people';
export * from './programs';

// Re-export for convenience
export { organizations } from './organizations';
export { people } from './people';
export { programs, cohorts, enrollments } from './programs';
