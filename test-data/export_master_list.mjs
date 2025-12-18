// Export all test people with their complete information to HTML
// Usage: cd /Users/yaronkra/Jarvis/projects/hkf-crm && node test-data/export_master_list.mjs

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const postgres = require('../apps/api/node_modules/postgres');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATABASE_URL = 'postgresql://postgres:nBC6IczzuMfITxCT@db.txjyyvzyahqmjndfsnzx.supabase.co:5432/postgres';

const sql = postgres(DATABASE_URL, {
  ssl: 'require',
  max: 1
});

console.log('Fetching all test people with their related data...');

try {
  // Get all test people with their enrollments, interviews, and payments
  const people = await sql`
    SELECT
      p.id,
      p.first_name,
      p.last_name,
      p.email,
      p.phone,
      p.status as person_status,
      p.metadata,
      p.tags,
      p.created_at as person_created_at,
      e.id as enrollment_id,
      e.status as enrollment_status,
      e.application_data,
      e.applied_at,
      e.enrolled_at,
      i.id as interview_id,
      i.scheduled_at,
      i.duration_minutes,
      i.location as interview_location,
      i.status as interview_status,
      i.outcome as interview_outcome,
      i.notes as interview_notes,
      i.interviewer_notes,
      py.id as payment_id,
      py.amount,
      py.currency,
      py.status as payment_status,
      py.payment_method,
      py.paid_at
    FROM people p
    LEFT JOIN enrollments e ON e.person_id = p.id
    LEFT JOIN interviews i ON i.person_id = p.id
    LEFT JOIN payments py ON py.person_id = p.id
    WHERE 'TEST_DATA' = ANY(p.tags)
    ORDER BY p.last_name, p.first_name
  `;

  console.log(`Found ${people.length} records (people with their related data)`);

  // Group by person
  const peopleMap = new Map();
  for (const row of people) {
    const key = row.id;
    if (!peopleMap.has(key)) {
      peopleMap.set(key, {
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        phone: row.phone,
        status: row.person_status,
        metadata: row.metadata,
        tags: row.tags,
        createdAt: row.person_created_at,
        enrollment: null,
        interview: null,
        payment: null
      });
    }
    const person = peopleMap.get(key);

    if (row.enrollment_id && !person.enrollment) {
      person.enrollment = {
        id: row.enrollment_id,
        status: row.enrollment_status,
        applicationData: row.application_data,
        appliedAt: row.applied_at,
        enrolledAt: row.enrolled_at
      };
    }

    if (row.interview_id && !person.interview) {
      person.interview = {
        id: row.interview_id,
        scheduledAt: row.scheduled_at,
        duration: row.duration_minutes,
        location: row.interview_location,
        status: row.interview_status,
        outcome: row.interview_outcome,
        notes: row.interview_notes,
        interviewerNotes: row.interviewer_notes
      };
    }

    if (row.payment_id && !person.payment) {
      person.payment = {
        id: row.payment_id,
        amount: row.amount,
        currency: row.currency,
        status: row.payment_status,
        method: row.payment_method,
        paidAt: row.paid_at
      };
    }
  }

  const allPeople = Array.from(peopleMap.values());
  console.log(`Grouped into ${allPeople.length} unique people`);

  // Generate HTML
  const html = generateHTML(allPeople);

  const outputPath = join(__dirname, 'test_people_master_list.html');
  writeFileSync(outputPath, html);
  console.log(`\n✅ Master list saved to: ${outputPath}`);

} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
} finally {
  await sql.end();
}

function formatDate(date) {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getStatusBadge(status) {
  const colors = {
    // Person status
    'pending': '#f59e0b',
    'active': '#10b981',
    'inactive': '#ef4444',
    'archived': '#6b7280',
    // Enrollment status
    'applied': '#3b82f6',
    'interviewing': '#8b5cf6',
    'accepted': '#10b981',
    'rejected': '#ef4444',
    'enrolled': '#059669',
    'completed': '#047857',
    'dropped': '#6b7280',
    // Interview status
    'scheduled': '#3b82f6',
    'no_show': '#ef4444',
    // Interview outcome
    'passed': '#10b981',
    'failed': '#ef4444',
    'pending_decision': '#f59e0b'
  };
  const color = colors[status] || '#6b7280';
  return `<span style="background:${color}; color:white; padding:2px 8px; border-radius:4px; font-size:12px; font-weight:500;">${status || '-'}</span>`;
}

function generateHTML(people) {
  const rows = people.map((p, idx) => {
    const metadata = p.metadata || {};
    const enrollment = p.enrollment || {};
    const interview = p.interview || {};
    const payment = p.payment || {};
    const interviewerNotes = interview.interviewerNotes || {};
    const applicationData = enrollment.applicationData || {};

    return `
    <div class="person-card" id="person-${idx + 1}">
      <div class="person-header">
        <span class="person-number">#${idx + 1}</span>
        <h2>${p.firstName} ${p.lastName}</h2>
        ${getStatusBadge(p.status)}
      </div>

      <div class="section">
        <h3>📋 Basic Information</h3>
        <table>
          <tr><td class="label">ID</td><td class="value mono">${p.id}</td></tr>
          <tr><td class="label">Email</td><td class="value">${p.email || '-'}</td></tr>
          <tr><td class="label">Phone</td><td class="value">${p.phone || '-'}</td></tr>
          <tr><td class="label">Tags</td><td class="value">${(p.tags || []).join(', ')}</td></tr>
          <tr><td class="label">Created</td><td class="value">${formatDate(p.createdAt)}</td></tr>
        </table>
      </div>

      <div class="section">
        <h3>👤 Profile Metadata</h3>
        <table>
          <tr><td class="label">Source</td><td class="value">${metadata.source || '-'}</td></tr>
          <tr><td class="label">City</td><td class="value">${metadata.city || '-'}</td></tr>
          <tr><td class="label">Occupation</td><td class="value">${metadata.occupation || '-'}</td></tr>
          <tr><td class="label">Age</td><td class="value">${metadata.age || '-'}</td></tr>
        </table>
      </div>

      <div class="section">
        <h3>📝 Enrollment</h3>
        ${p.enrollment ? `
        <table>
          <tr><td class="label">Status</td><td class="value">${getStatusBadge(enrollment.status)}</td></tr>
          <tr><td class="label">Applied</td><td class="value">${formatDate(enrollment.appliedAt)}</td></tr>
          <tr><td class="label">Enrolled</td><td class="value">${formatDate(enrollment.enrolledAt)}</td></tr>
          <tr><td class="label">Motivation</td><td class="value">${applicationData.motivation || '-'}</td></tr>
          <tr><td class="label">Experience</td><td class="value">${applicationData.experience || '-'}</td></tr>
        </table>
        ` : '<p class="no-data">No enrollment record</p>'}
      </div>

      <div class="section">
        <h3>🎤 Interview</h3>
        ${p.interview ? `
        <table>
          <tr><td class="label">Status</td><td class="value">${getStatusBadge(interview.status)}</td></tr>
          <tr><td class="label">Scheduled</td><td class="value">${formatDate(interview.scheduledAt)}</td></tr>
          <tr><td class="label">Duration</td><td class="value">${interview.duration || '-'} min</td></tr>
          <tr><td class="label">Location</td><td class="value">${interview.location || '-'}</td></tr>
          <tr><td class="label">Outcome</td><td class="value">${getStatusBadge(interview.outcome)}</td></tr>
          <tr><td class="label">Score</td><td class="value">${interviewerNotes.score || '-'}/10</td></tr>
          <tr><td class="label">Recommendation</td><td class="value">${interviewerNotes.recommendation || '-'}</td></tr>
          <tr><td class="label">Strengths</td><td class="value">${(interviewerNotes.strengths || []).join(', ') || '-'}</td></tr>
          <tr><td class="label">Concerns</td><td class="value">${(interviewerNotes.concerns || []).join(', ') || '-'}</td></tr>
          <tr><td class="label">Notes</td><td class="value">${interview.notes || '-'}</td></tr>
        </table>
        ` : '<p class="no-data">No interview record</p>'}
      </div>

      <div class="section">
        <h3>💳 Payment</h3>
        ${p.payment ? `
        <table>
          <tr><td class="label">Status</td><td class="value">${getStatusBadge(payment.status)}</td></tr>
          <tr><td class="label">Amount</td><td class="value">${payment.currency} ${(payment.amount / 100).toFixed(2)}</td></tr>
          <tr><td class="label">Method</td><td class="value">${payment.method || '-'}</td></tr>
          <tr><td class="label">Paid At</td><td class="value">${formatDate(payment.paidAt)}</td></tr>
        </table>
        ` : '<p class="no-data">No payment record</p>'}
      </div>
    </div>
    `;
  }).join('\n');

  // Count statistics
  const stats = {
    total: people.length,
    withEnrollment: people.filter(p => p.enrollment).length,
    withInterview: people.filter(p => p.interview).length,
    withPayment: people.filter(p => p.payment).length,
    byPersonStatus: {},
    byEnrollmentStatus: {},
    byInterviewStatus: {}
  };

  people.forEach(p => {
    stats.byPersonStatus[p.status] = (stats.byPersonStatus[p.status] || 0) + 1;
    if (p.enrollment) {
      stats.byEnrollmentStatus[p.enrollment.status] = (stats.byEnrollmentStatus[p.enrollment.status] || 0) + 1;
    }
    if (p.interview) {
      stats.byInterviewStatus[p.interview.status] = (stats.byInterviewStatus[p.interview.status] || 0) + 1;
    }
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HKF CRM - Test People Master List</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f3f4f6;
      color: #1f2937;
      line-height: 1.5;
      padding: 20px;
    }
    .container { max-width: 900px; margin: 0 auto; }

    header {
      background: linear-gradient(135deg, #1e40af 0%, #7c3aed 100%);
      color: white;
      padding: 30px;
      border-radius: 12px;
      margin-bottom: 30px;
    }
    header h1 { font-size: 28px; margin-bottom: 10px; }
    header p { opacity: 0.9; }

    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-bottom: 30px;
    }
    .stat-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .stat-card h4 { font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 5px; }
    .stat-card .value { font-size: 32px; font-weight: 700; color: #1e40af; }
    .stat-card .breakdown { font-size: 12px; color: #6b7280; margin-top: 8px; }

    .toc {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .toc h3 { margin-bottom: 15px; }
    .toc-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 8px;
      max-height: 300px;
      overflow-y: auto;
    }
    .toc a {
      color: #1e40af;
      text-decoration: none;
      font-size: 13px;
      padding: 4px 8px;
      border-radius: 4px;
      transition: background 0.2s;
    }
    .toc a:hover { background: #f3f4f6; }

    .person-card {
      background: white;
      border-radius: 12px;
      margin-bottom: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .person-header {
      background: #f8fafc;
      padding: 15px 20px;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .person-number {
      background: #1e40af;
      color: white;
      padding: 4px 10px;
      border-radius: 4px;
      font-weight: 600;
      font-size: 14px;
    }
    .person-header h2 { font-size: 18px; flex: 1; }

    .section {
      padding: 15px 20px;
      border-bottom: 1px solid #f3f4f6;
    }
    .section:last-child { border-bottom: none; }
    .section h3 {
      font-size: 14px;
      color: #6b7280;
      margin-bottom: 12px;
    }

    table { width: 100%; border-collapse: collapse; }
    td { padding: 6px 0; vertical-align: top; }
    td.label {
      width: 120px;
      font-size: 13px;
      color: #6b7280;
      font-weight: 500;
    }
    td.value { font-size: 14px; }
    td.mono { font-family: monospace; font-size: 11px; color: #6b7280; }

    .no-data {
      color: #9ca3af;
      font-style: italic;
      font-size: 13px;
    }

    @media print {
      body { background: white; padding: 0; }
      .person-card { break-inside: avoid; box-shadow: none; border: 1px solid #e5e7eb; }
      .toc { display: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>HKF CRM - Test People Master List</h1>
      <p>Generated: ${new Date().toLocaleString('en-GB')} | Total: ${stats.total} people</p>
    </header>

    <div class="stats">
      <div class="stat-card">
        <h4>Total People</h4>
        <div class="value">${stats.total}</div>
        <div class="breakdown">
          ${Object.entries(stats.byPersonStatus).map(([k,v]) => `${k}: ${v}`).join(' · ')}
        </div>
      </div>
      <div class="stat-card">
        <h4>Enrollments</h4>
        <div class="value">${stats.withEnrollment}</div>
        <div class="breakdown">
          ${Object.entries(stats.byEnrollmentStatus).map(([k,v]) => `${k}: ${v}`).join(' · ')}
        </div>
      </div>
      <div class="stat-card">
        <h4>Interviews</h4>
        <div class="value">${stats.withInterview}</div>
        <div class="breakdown">
          ${Object.entries(stats.byInterviewStatus).map(([k,v]) => `${k}: ${v}`).join(' · ')}
        </div>
      </div>
      <div class="stat-card">
        <h4>Payments</h4>
        <div class="value">${stats.withPayment}</div>
      </div>
    </div>

    <div class="toc">
      <h3>📑 Quick Navigation</h3>
      <div class="toc-grid">
        ${people.map((p, i) => `<a href="#person-${i+1}">#${i+1} ${p.firstName} ${p.lastName}</a>`).join('\n        ')}
      </div>
    </div>

    ${rows}
  </div>
</body>
</html>`;
}
