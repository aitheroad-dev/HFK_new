-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  person_id UUID NOT NULL REFERENCES people(id),
  program_id UUID REFERENCES programs(id),
  enrollment_id UUID REFERENCES enrollments(id),
  
  amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'ILS',
  description TEXT,
  
  status TEXT DEFAULT 'pending',
  
  provider TEXT,
  external_id TEXT,
  external_data JSONB,
  
  payment_method TEXT,
  
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS payments_org_idx ON payments(organization_id);
CREATE INDEX IF NOT EXISTS payments_person_idx ON payments(person_id);
CREATE INDEX IF NOT EXISTS payments_program_idx ON payments(program_id);
CREATE INDEX IF NOT EXISTS payments_enrollment_idx ON payments(enrollment_id);
CREATE INDEX IF NOT EXISTS payments_status_idx ON payments(status);
