// Export all test people to a filterable HTML table with Hebrew RTL support
// Usage: cd /Users/yaronkra/Jarvis/projects/hkf-crm && node test-data/export_filterable_table_hebrew.mjs

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

console.log('מביא את כל נתוני הבדיקה...');

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

  console.log(`נמצאו ${people.length} רשומות`);

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
  console.log(`${allPeople.length} אנשים ייחודיים`);

  // Generate HTML
  const html = generateHTML(allPeople);

  const outputPath = join(__dirname, 'test_people_filterable_table_hebrew.html');
  writeFileSync(outputPath, html);
  console.log(`\n✅ הטבלה נשמרה ב: ${outputPath}`);

} catch (error) {
  console.error('שגיאה:', error.message);
  process.exit(1);
} finally {
  await sql.end();
}

function generateHTML(people) {
  // Status translations
  const statusHebrew = {
    'pending': 'ממתין',
    'active': 'פעיל',
    'inactive': 'לא פעיל',
    'archived': 'בארכיון',
    'applied': 'הגיש מועמדות',
    'interviewing': 'בתהליך ריאיון',
    'accepted': 'התקבל',
    'rejected': 'נדחה',
    'enrolled': 'רשום',
    'completed': 'הושלם',
    'dropped': 'פרש',
    'scheduled': 'מתוכנן',
    'no_show': 'לא הגיע',
    'passed': 'עבר',
    'failed': 'נכשל',
    'pending_decision': 'ממתין להחלטה',
    'paid': 'שולם'
  };

  // Prepare JSON data for JavaScript
  const jsonData = JSON.stringify(people.map((p, idx) => ({
    num: idx + 1,
    id: p.id,
    firstName: p.firstName || '',
    lastName: p.lastName || '',
    fullName: `${p.firstName || ''} ${p.lastName || ''}`.trim(),
    email: p.email || '',
    phone: p.phone || '',
    personStatus: p.status || '',
    personStatusHeb: statusHebrew[p.status] || p.status || '',
    city: p.metadata?.city || '',
    source: p.metadata?.source || '',
    occupation: p.metadata?.occupation || '',
    age: p.metadata?.age || '',
    tags: (p.tags || []).join(', '),
    createdAt: p.createdAt ? new Date(p.createdAt).toLocaleDateString('he-IL') : '',
    hasEnrollment: !!p.enrollment,
    enrollmentStatus: p.enrollment?.status || '',
    enrollmentStatusHeb: statusHebrew[p.enrollment?.status] || p.enrollment?.status || '',
    appliedAt: p.enrollment?.appliedAt ? new Date(p.enrollment.appliedAt).toLocaleDateString('he-IL') : '',
    enrolledAt: p.enrollment?.enrolledAt ? new Date(p.enrollment.enrolledAt).toLocaleDateString('he-IL') : '',
    motivation: p.enrollment?.applicationData?.motivation || '',
    experience: p.enrollment?.applicationData?.experience || '',
    hasInterview: !!p.interview,
    interviewStatus: p.interview?.status || '',
    interviewStatusHeb: statusHebrew[p.interview?.status] || p.interview?.status || '',
    interviewOutcome: p.interview?.outcome || '',
    interviewOutcomeHeb: statusHebrew[p.interview?.outcome] || p.interview?.outcome || '',
    interviewScheduledAt: p.interview?.scheduledAt ? new Date(p.interview.scheduledAt).toLocaleDateString('he-IL') : '',
    interviewLocation: p.interview?.location || '',
    interviewDuration: p.interview?.duration || '',
    interviewScore: p.interview?.interviewerNotes?.score || '',
    interviewRecommendation: p.interview?.interviewerNotes?.recommendation || '',
    interviewStrengths: (p.interview?.interviewerNotes?.strengths || []).join(', '),
    interviewConcerns: (p.interview?.interviewerNotes?.concerns || []).join(', '),
    interviewNotes: p.interview?.notes || '',
    hasPayment: !!p.payment,
    paymentStatus: p.payment?.status || '',
    paymentStatusHeb: statusHebrew[p.payment?.status] || p.payment?.status || '',
    paymentAmount: p.payment?.amount ? `₪${(p.payment.amount / 100).toLocaleString('he-IL')}` : '',
    paymentMethod: p.payment?.method || '',
    paidAt: p.payment?.paidAt ? new Date(p.payment.paidAt).toLocaleDateString('he-IL') : ''
  })));

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HKF CRM - טבלת אנשי בדיקה</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      background: #f3f4f6;
      color: #1f2937;
      line-height: 1.6;
      direction: rtl;
    }

    header {
      background: linear-gradient(135deg, #1e40af 0%, #7c3aed 100%);
      color: white;
      padding: 20px 30px;
      position: sticky;
      top: 0;
      z-index: 100;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    }
    header h1 { font-size: 24px; margin-bottom: 5px; }
    header p { opacity: 0.9; font-size: 14px; }

    .controls {
      background: white;
      padding: 15px 20px;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      gap: 15px;
      flex-wrap: wrap;
      align-items: center;
      position: sticky;
      top: 68px;
      z-index: 99;
    }

    .search-box {
      flex: 1;
      min-width: 200px;
      position: relative;
    }
    .search-box input {
      width: 100%;
      padding: 10px 40px 10px 15px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s;
      direction: rtl;
    }
    .search-box input:focus { border-color: #1e40af; }
    .search-box::after {
      content: "🔍";
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 16px;
    }

    .filter-group {
      display: flex;
      gap: 10px;
      align-items: center;
    }
    .filter-group label {
      font-size: 13px;
      color: #6b7280;
      font-weight: 500;
    }
    .filter-group select {
      padding: 8px 12px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 13px;
      background: white;
      cursor: pointer;
      direction: rtl;
    }

    .stats-bar {
      background: #f8fafc;
      padding: 10px 20px;
      border-bottom: 1px solid #e5e7eb;
      font-size: 13px;
      color: #6b7280;
      display: flex;
      gap: 20px;
    }
    .stats-bar strong { color: #1e40af; }

    .table-container {
      overflow-x: auto;
      padding: 0;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      min-width: 2200px;
    }

    thead {
      background: #f8fafc;
      position: sticky;
      top: 126px;
      z-index: 50;
    }

    th {
      padding: 12px 10px;
      text-align: right;
      font-weight: 600;
      color: #374151;
      border-bottom: 2px solid #e5e7eb;
      white-space: nowrap;
      cursor: pointer;
      user-select: none;
      position: relative;
    }
    th:hover { background: #f1f5f9; }
    th.sorted-asc::before { content: " ▲"; font-size: 10px; }
    th.sorted-desc::before { content: " ▼"; font-size: 10px; }

    th input {
      width: 100%;
      padding: 5px 8px;
      margin-top: 6px;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      font-size: 12px;
      font-weight: normal;
      direction: rtl;
    }
    th input:focus { outline: none; border-color: #1e40af; }

    td {
      padding: 10px;
      border-bottom: 1px solid #e5e7eb;
      vertical-align: top;
      text-align: right;
    }

    tr:hover td { background: #f8fafc; }
    tr.hidden { display: none; }

    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
    }
    .badge-pending, .badge-ממתין { background: #fef3c7; color: #92400e; }
    .badge-active, .badge-פעיל { background: #d1fae5; color: #065f46; }
    .badge-inactive, .badge-לא-פעיל { background: #fee2e2; color: #991b1b; }
    .badge-applied, .badge-הגיש-מועמדות { background: #dbeafe; color: #1e40af; }
    .badge-interviewing, .badge-בתהליך-ריאיון { background: #ede9fe; color: #5b21b6; }
    .badge-accepted, .badge-התקבל { background: #d1fae5; color: #065f46; }
    .badge-rejected, .badge-נדחה { background: #fee2e2; color: #991b1b; }
    .badge-enrolled, .badge-רשום { background: #a7f3d0; color: #047857; }
    .badge-completed, .badge-הושלם { background: #6ee7b7; color: #047857; }
    .badge-dropped, .badge-פרש { background: #e5e7eb; color: #374151; }
    .badge-scheduled, .badge-מתוכנן { background: #dbeafe; color: #1e40af; }
    .badge-no_show, .badge-לא-הגיע { background: #fee2e2; color: #991b1b; }
    .badge-passed, .badge-עבר { background: #d1fae5; color: #065f46; }
    .badge-failed, .badge-נכשל { background: #fee2e2; color: #991b1b; }
    .badge-pending_decision, .badge-ממתין-להחלטה { background: #fef3c7; color: #92400e; }
    .badge-paid, .badge-שולם { background: #d1fae5; color: #065f46; }

    .num-cell {
      font-weight: 600;
      color: #1e40af;
      text-align: center;
    }

    .email-cell {
      font-family: monospace;
      font-size: 12px;
      color: #6b7280;
      direction: ltr;
      text-align: left;
    }

    .phone-cell {
      direction: ltr;
      text-align: left;
    }

    .no-data { color: #9ca3af; font-style: italic; }

    .clear-filters {
      padding: 8px 16px;
      background: #ef4444;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
    }
    .clear-filters:hover { background: #dc2626; }

    .export-btn {
      padding: 8px 16px;
      background: #10b981;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
    }
    .export-btn:hover { background: #059669; }

    @media print {
      header, .controls, .stats-bar { display: none; }
      table { font-size: 10px; min-width: auto; }
      th, td { padding: 4px; }
    }
  </style>
</head>
<body>
  <header>
    <h1>HKF CRM - טבלת אנשי בדיקה</h1>
    <p>נוצר: ${new Date().toLocaleDateString('he-IL')} | ניתן לסנן לפי כל עמודה</p>
  </header>

  <div class="controls">
    <div class="search-box">
      <input type="text" id="globalSearch" placeholder="חיפוש בכל העמודות...">
    </div>

    <div class="filter-group">
      <label>סטטוס אדם:</label>
      <select id="filterPersonStatus">
        <option value="">הכל</option>
        <option value="pending">ממתין</option>
        <option value="active">פעיל</option>
        <option value="inactive">לא פעיל</option>
      </select>
    </div>

    <div class="filter-group">
      <label>הרשמה:</label>
      <select id="filterEnrollmentStatus">
        <option value="">הכל</option>
        <option value="applied">הגיש מועמדות</option>
        <option value="interviewing">בתהליך ריאיון</option>
        <option value="accepted">התקבל</option>
        <option value="rejected">נדחה</option>
        <option value="enrolled">רשום</option>
        <option value="completed">הושלם</option>
        <option value="dropped">פרש</option>
        <option value="_none">ללא הרשמה</option>
      </select>
    </div>

    <div class="filter-group">
      <label>ריאיון:</label>
      <select id="filterInterviewStatus">
        <option value="">הכל</option>
        <option value="scheduled">מתוכנן</option>
        <option value="completed">הושלם</option>
        <option value="no_show">לא הגיע</option>
        <option value="_none">ללא ריאיון</option>
      </select>
    </div>

    <div class="filter-group">
      <label>תשלום:</label>
      <select id="filterPaymentStatus">
        <option value="">הכל</option>
        <option value="pending">ממתין</option>
        <option value="completed">שולם</option>
        <option value="_none">ללא תשלום</option>
      </select>
    </div>

    <button class="clear-filters" onclick="clearFilters()">נקה מסננים</button>
    <button class="export-btn" onclick="exportCSV()">ייצוא CSV</button>
  </div>

  <div class="stats-bar">
    <span>מציג: <strong id="visibleCount">${people.length}</strong> מתוך <strong>${people.length}</strong> אנשים</span>
    <span>עם הרשמה: <strong>${people.filter(p => p.enrollment).length}</strong></span>
    <span>עם ריאיון: <strong>${people.filter(p => p.interview).length}</strong></span>
    <span>עם תשלום: <strong>${people.filter(p => p.payment).length}</strong></span>
  </div>

  <div class="table-container">
    <table id="peopleTable">
      <thead>
        <tr>
          <th data-col="num">#</th>
          <th data-col="firstName">שם פרטי<input type="text" data-filter="firstName" placeholder="סנן..."></th>
          <th data-col="lastName">שם משפחה<input type="text" data-filter="lastName" placeholder="סנן..."></th>
          <th data-col="email">אימייל<input type="text" data-filter="email" placeholder="סנן..."></th>
          <th data-col="phone">טלפון<input type="text" data-filter="phone" placeholder="סנן..."></th>
          <th data-col="personStatus">סטטוס</th>
          <th data-col="city">עיר<input type="text" data-filter="city" placeholder="סנן..."></th>
          <th data-col="source">מקור<input type="text" data-filter="source" placeholder="סנן..."></th>
          <th data-col="occupation">מקצוע<input type="text" data-filter="occupation" placeholder="סנן..."></th>
          <th data-col="age">גיל</th>
          <th data-col="enrollmentStatus">הרשמה</th>
          <th data-col="appliedAt">תאריך הגשה</th>
          <th data-col="motivation">מוטיבציה<input type="text" data-filter="motivation" placeholder="סנן..."></th>
          <th data-col="interviewStatus">ריאיון</th>
          <th data-col="interviewOutcome">תוצאה</th>
          <th data-col="interviewScore">ציון</th>
          <th data-col="interviewRecommendation">המלצה<input type="text" data-filter="interviewRecommendation" placeholder="סנן..."></th>
          <th data-col="interviewLocation">מיקום<input type="text" data-filter="interviewLocation" placeholder="סנן..."></th>
          <th data-col="interviewNotes">הערות ריאיון<input type="text" data-filter="interviewNotes" placeholder="סנן..."></th>
          <th data-col="paymentStatus">תשלום</th>
          <th data-col="paymentAmount">סכום</th>
          <th data-col="paymentMethod">אמצעי תשלום</th>
        </tr>
      </thead>
      <tbody id="tableBody">
      </tbody>
    </table>
  </div>

  <script>
    const data = ${jsonData};
    let sortCol = null;
    let sortAsc = true;

    function getBadgeClass(status) {
      if (!status) return '';
      return 'badge badge-' + status.toLowerCase().replace(/[ _]/g, '-');
    }

    function renderTable(filteredData) {
      const tbody = document.getElementById('tableBody');
      tbody.innerHTML = filteredData.map(p => \`
        <tr>
          <td class="num-cell">\${p.num}</td>
          <td>\${p.firstName || '<span class="no-data">-</span>'}</td>
          <td>\${p.lastName || '<span class="no-data">-</span>'}</td>
          <td class="email-cell">\${p.email || '<span class="no-data">-</span>'}</td>
          <td class="phone-cell">\${p.phone || '<span class="no-data">-</span>'}</td>
          <td><span class="\${getBadgeClass(p.personStatusHeb)}">\${p.personStatusHeb || '-'}</span></td>
          <td>\${p.city || '<span class="no-data">-</span>'}</td>
          <td>\${p.source || '<span class="no-data">-</span>'}</td>
          <td>\${p.occupation || '<span class="no-data">-</span>'}</td>
          <td>\${p.age || '<span class="no-data">-</span>'}</td>
          <td>\${p.enrollmentStatusHeb ? \`<span class="\${getBadgeClass(p.enrollmentStatusHeb)}">\${p.enrollmentStatusHeb}</span>\` : '<span class="no-data">-</span>'}</td>
          <td>\${p.appliedAt || '<span class="no-data">-</span>'}</td>
          <td>\${p.motivation || '<span class="no-data">-</span>'}</td>
          <td>\${p.interviewStatusHeb ? \`<span class="\${getBadgeClass(p.interviewStatusHeb)}">\${p.interviewStatusHeb}</span>\` : '<span class="no-data">-</span>'}</td>
          <td>\${p.interviewOutcomeHeb ? \`<span class="\${getBadgeClass(p.interviewOutcomeHeb)}">\${p.interviewOutcomeHeb}</span>\` : '<span class="no-data">-</span>'}</td>
          <td>\${p.interviewScore ? p.interviewScore + '/10' : '<span class="no-data">-</span>'}</td>
          <td>\${p.interviewRecommendation || '<span class="no-data">-</span>'}</td>
          <td>\${p.interviewLocation || '<span class="no-data">-</span>'}</td>
          <td>\${p.interviewNotes || '<span class="no-data">-</span>'}</td>
          <td>\${p.paymentStatusHeb ? \`<span class="\${getBadgeClass(p.paymentStatusHeb)}">\${p.paymentStatusHeb}</span>\` : '<span class="no-data">-</span>'}</td>
          <td>\${p.paymentAmount || '<span class="no-data">-</span>'}</td>
          <td>\${p.paymentMethod || '<span class="no-data">-</span>'}</td>
        </tr>
      \`).join('');

      document.getElementById('visibleCount').textContent = filteredData.length;
    }

    function getFilteredData() {
      const globalSearch = document.getElementById('globalSearch').value.toLowerCase();
      const personStatus = document.getElementById('filterPersonStatus').value;
      const enrollmentStatus = document.getElementById('filterEnrollmentStatus').value;
      const interviewStatus = document.getElementById('filterInterviewStatus').value;
      const paymentStatus = document.getElementById('filterPaymentStatus').value;

      // Column filters
      const colFilters = {};
      document.querySelectorAll('th input[data-filter]').forEach(input => {
        if (input.value) {
          colFilters[input.dataset.filter] = input.value.toLowerCase();
        }
      });

      let filtered = data.filter(p => {
        // Global search
        if (globalSearch) {
          const searchStr = Object.values(p).join(' ').toLowerCase();
          if (!searchStr.includes(globalSearch)) return false;
        }

        // Dropdown filters
        if (personStatus && p.personStatus !== personStatus) return false;
        if (enrollmentStatus === '_none' && p.hasEnrollment) return false;
        if (enrollmentStatus && enrollmentStatus !== '_none' && p.enrollmentStatus !== enrollmentStatus) return false;
        if (interviewStatus === '_none' && p.hasInterview) return false;
        if (interviewStatus && interviewStatus !== '_none' && p.interviewStatus !== interviewStatus) return false;
        if (paymentStatus === '_none' && p.hasPayment) return false;
        if (paymentStatus && paymentStatus !== '_none' && p.paymentStatus !== paymentStatus) return false;

        // Column filters
        for (const [col, val] of Object.entries(colFilters)) {
          if (!String(p[col] || '').toLowerCase().includes(val)) return false;
        }

        return true;
      });

      // Sort
      if (sortCol) {
        filtered.sort((a, b) => {
          const aVal = a[sortCol] || '';
          const bVal = b[sortCol] || '';
          if (typeof aVal === 'number' && typeof bVal === 'number') {
            return sortAsc ? aVal - bVal : bVal - aVal;
          }
          return sortAsc
            ? String(aVal).localeCompare(String(bVal), 'he')
            : String(bVal).localeCompare(String(aVal), 'he');
        });
      }

      return filtered;
    }

    function applyFilters() {
      renderTable(getFilteredData());
    }

    function clearFilters() {
      document.getElementById('globalSearch').value = '';
      document.getElementById('filterPersonStatus').value = '';
      document.getElementById('filterEnrollmentStatus').value = '';
      document.getElementById('filterInterviewStatus').value = '';
      document.getElementById('filterPaymentStatus').value = '';
      document.querySelectorAll('th input[data-filter]').forEach(input => input.value = '');
      sortCol = null;
      sortAsc = true;
      document.querySelectorAll('th').forEach(th => th.classList.remove('sorted-asc', 'sorted-desc'));
      applyFilters();
    }

    function exportCSV() {
      const filtered = getFilteredData();
      const headers = ['#', 'שם פרטי', 'שם משפחה', 'אימייל', 'טלפון', 'סטטוס', 'עיר', 'מקור', 'מקצוע', 'גיל', 'הרשמה', 'תאריך הגשה', 'מוטיבציה', 'ריאיון', 'תוצאה', 'ציון', 'המלצה', 'מיקום', 'הערות', 'תשלום', 'סכום', 'אמצעי תשלום'];
      const rows = filtered.map(p => [
        p.num, p.firstName, p.lastName, p.email, p.phone, p.personStatusHeb, p.city, p.source, p.occupation, p.age,
        p.enrollmentStatusHeb, p.appliedAt, p.motivation, p.interviewStatusHeb, p.interviewOutcomeHeb, p.interviewScore,
        p.interviewRecommendation, p.interviewLocation, p.interviewNotes, p.paymentStatusHeb, p.paymentAmount, p.paymentMethod
      ]);

      // Add BOM for Hebrew Excel support
      const BOM = '\\uFEFF';
      const csv = BOM + [headers, ...rows].map(row => row.map(cell => \`"\${String(cell || '').replace(/"/g, '""')}"\`).join(',')).join('\\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'אנשי_בדיקה_מסוננים.csv';
      a.click();
    }

    // Event listeners
    document.getElementById('globalSearch').addEventListener('input', applyFilters);
    document.getElementById('filterPersonStatus').addEventListener('change', applyFilters);
    document.getElementById('filterEnrollmentStatus').addEventListener('change', applyFilters);
    document.getElementById('filterInterviewStatus').addEventListener('change', applyFilters);
    document.getElementById('filterPaymentStatus').addEventListener('change', applyFilters);
    document.querySelectorAll('th input[data-filter]').forEach(input => {
      input.addEventListener('input', applyFilters);
      input.addEventListener('click', e => e.stopPropagation());
    });

    // Sorting
    document.querySelectorAll('th[data-col]').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.col;
        if (sortCol === col) {
          sortAsc = !sortAsc;
        } else {
          sortCol = col;
          sortAsc = true;
        }
        document.querySelectorAll('th').forEach(t => t.classList.remove('sorted-asc', 'sorted-desc'));
        th.classList.add(sortAsc ? 'sorted-asc' : 'sorted-desc');
        applyFilters();
      });
    });

    // Initial render
    renderTable(data);
  </script>
</body>
</html>`;
}
