# AI Document Generation

> **Implemented**: 2025-12-26
> **Feature**: Generate exportable documents (PDF/CSV) from CRM data via AI

---

## Overview

This feature enables the JARVIS AI assistant to generate documents and reports on demand. Users can request reports through natural language, and the AI will create downloadable PDF or CSV files.

**Capabilities:**
1. **PDF Generation** - Formatted reports with tables, headers, and Hebrew RTL support
2. **CSV Export** - Spreadsheet-compatible data exports with UTF-8 BOM
3. **Multiple Data Sources** - Payments, people, programs, interviews, events
4. **Filtering** - Date ranges, status, person, program filters
5. **Storage** - Files saved to Supabase Storage with signed download URLs
6. **Audit Trail** - All documents tracked in database with metadata

---

## Architecture

### Data Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│  AI Agent   │────▶│  Document   │────▶│  Supabase   │
│ (WebSocket) │     │  (Claude)   │     │  Generator  │     │  Storage    │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │                   │
       │  1. "Generate     │                   │                   │
       │  payments report" │                   │                   │
       │──────────────────▶│                   │                   │
       │                   │  2. Call          │                   │
       │                   │  create_document  │                   │
       │                   │──────────────────▶│                   │
       │                   │                   │  3. Fetch data    │
       │                   │                   │──────────────────▶│
       │                   │                   │                   │
       │                   │                   │  4. Generate PDF  │
       │                   │                   │  or CSV           │
       │                   │                   │                   │
       │                   │                   │  5. Upload file   │
       │                   │                   │──────────────────▶│
       │                   │                   │                   │
       │                   │  6. Return URL    │                   │
       │                   │◀──────────────────│                   │
       │  7. "Document     │                   │                   │
       │  ready: [link]"   │                   │                   │
       │◀──────────────────│                   │                   │
```

---

## Database Schema

### Table: `ai_documents`

Stores document metadata and references to files in storage.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `organization_id` | UUID | FK to organizations |
| `conversation_id` | UUID | Optional: link to AI conversation |
| `title` | TEXT | Document title (Hebrew supported) |
| `description` | TEXT | Brief description |
| `document_type` | TEXT | Type enum (see below) |
| `format` | TEXT | 'pdf' or 'csv' |
| `storage_path` | TEXT | Path in Supabase Storage |
| `file_name` | TEXT | Original file name |
| `file_size` | INTEGER | Size in bytes |
| `mime_type` | TEXT | MIME type |
| `status` | TEXT | 'generating', 'ready', 'failed', 'archived' |
| `metadata` | JSONB | Filters, record count, columns |
| `created_by_user_id` | UUID | User who created |
| `created_by_email` | TEXT | Email for display |
| `created_at` | TIMESTAMP | Creation time |
| `updated_at` | TIMESTAMP | Last update |

### Document Types

| Type | Description |
|------|-------------|
| `payment_report` | Financial/payment summary |
| `people_list` | List of people with details |
| `program_report` | Program enrollment report |
| `interview_schedule` | Interview schedule/summary |
| `event_summary` | Event participation report |
| `custom_report` | Ad-hoc custom reports |

### Metadata Structure

```json
{
  "query": {
    "status": "completed",
    "fromDate": "2024-01-01"
  },
  "recordCount": 42,
  "columns": ["שם", "סכום", "סטטוס", "תאריך"],
  "options": {
    "filters": {...}
  },
  "storageError": null
}
```

---

## AI Tool: `create_document`

### Description

Generate a document (PDF or CSV) from CRM data.

### Input Schema

```typescript
{
  title: string;           // Document title in Hebrew
  description?: string;    // Brief description
  documentType: enum;      // Type of document
  format: 'pdf' | 'csv';   // Output format
  dataSource: enum;        // Which data to include
  filters?: {
    status?: string;
    fromDate?: string;     // ISO 8601
    toDate?: string;       // ISO 8601
    personId?: string;     // UUID
    programId?: string;    // UUID
  };
  customData?: object[];   // For custom_report type
  customColumns?: {
    key: string;
    label: string;         // Hebrew label
  }[];
}
```

### Data Sources

| Source | Description |
|--------|-------------|
| `payments` | Payment records with person names |
| `people` | People records |
| `programs` | Program enrollments |
| `interviews` | Interview schedule |
| `events` | Event records |
| `custom` | Custom data provided directly |

### Example Usage

**User:** "צור דוח תשלומים לחודש דצמבר"

**AI uses create_document with:**
```json
{
  "title": "דוח תשלומים דצמבר 2024",
  "documentType": "payment_report",
  "format": "pdf",
  "dataSource": "payments",
  "filters": {
    "fromDate": "2024-12-01",
    "toDate": "2024-12-31"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Document \"דוח תשלומים דצמבר 2024\" created successfully",
  "documentId": "uuid...",
  "fileName": "דוח_תשלומים_דצמבר_2024_1703595600000.pdf",
  "fileSize": 15234,
  "downloadUrl": "https://...",
  "recordCount": 42
}
```

---

## Backend Implementation

### Files

| File | Purpose |
|------|---------|
| `packages/db/src/schema/documents.ts` | Drizzle schema |
| `apps/api/src/ai/document-generator.ts` | PDF/CSV generation |
| `apps/api/src/ai/tools.ts` | Tool definition & handler |

### PDF Generation (pdfkit)

```typescript
import PDFDocument from 'pdfkit';

async function generatePdf(
  title: string,
  data: Record<string, unknown>[],
  columns: Array<{ key: string; label: string }>
): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  // ... generate PDF content
  return Buffer.concat(chunks);
}
```

Features:
- A4 page size with 50px margins
- Automatic page breaks
- Table with header row
- Hebrew date formatting
- Record count summary

### CSV Generation

```typescript
function generateCsv(
  data: Record<string, unknown>[],
  columns: Array<{ key: string; label: string }>
): Buffer {
  // UTF-8 BOM for Excel compatibility
  let csv = '\ufeff';
  // Header row + data rows
  return Buffer.from(csv, 'utf-8');
}
```

Features:
- UTF-8 BOM for Excel Hebrew support
- Proper CSV escaping (quotes, commas)
- Hebrew column headers

### Storage Upload

```typescript
const { error } = await supabase.storage
  .from('ai-documents')
  .upload(storagePath, buffer, {
    contentType: mimeType,
    upsert: false,
  });
```

Files are stored at: `{organizationId}/{timestamp}_{fileName}`

---

## Frontend Implementation

### Files

| File | Purpose |
|------|---------|
| `apps/web/src/hooks/useDocuments.ts` | React Query hooks |
| `apps/web/src/pages/Documents.tsx` | Documents page |

### React Query Hooks

| Hook | Purpose |
|------|---------|
| `useDocuments(options)` | List documents with filters |
| `useDocumentsWithUrls(options)` | List with download URLs |
| `useDocument(id)` | Single document with URL |
| `useArchiveDocument()` | Archive mutation |
| `useDeleteDocument()` | Delete mutation |
| `useDocumentStats()` | Dashboard statistics |

### Documents Page Features

1. **Stats Cards** - Total, ready, archived, PDF count, CSV count
2. **Documents Table** - Title, type, format, size, date, status
3. **Document Detail** - Full info, metadata, download button
4. **Actions** - Download, archive, delete

---

## UI Reference

### Documents List

```
┌────────────────────────────────────────────────────────────┐
│  מסמכים                                       [🔄 רענן]   │
├────────────────────────────────────────────────────────────┤
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐  │
│  │ סה"כ   │ │ מוכנים │ │ ארכיון │ │  PDF   │ │  CSV   │  │
│  │   12   │ │   10   │ │    2   │ │    8   │ │    4   │  │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘  │
├────────────────────────────────────────────────────────────┤
│  [הכל] [מוכנים] [ארכיון]                                   │
├────────────────────────────────────────────────────────────┤
│  כותרת              │ סוג       │ פורמט │ גודל  │ סטטוס  │
│  ─────────────────────────────────────────────────────────│
│  📄 דוח תשלומים     │ תשלומים   │ PDF   │ 15KB  │ מוכן   │
│  📊 רשימת משתתפים   │ אנשים     │ CSV   │ 8KB   │ מוכן   │
└────────────────────────────────────────────────────────────┘
```

### Document Detail

```
┌────────────────────────────────────────────────────────────┐
│  ← חזרה    📄 דוח תשלומים דצמבר 2024     [מוכן] [הורד]   │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  סוג מסמך: דוח תשלומים    פורמט: PDF                      │
│  גודל: 15.2 KB            נוצר על ידי: yaron@hkf.org      │
│                                                            │
│  תאריך יצירה: 26 דצמבר 2024, 15:30                         │
│  שם קובץ: דוח_תשלומים_דצמבר_2024_1703595600000.pdf         │
│  רשומות: 42                                                │
│                                                            │
│  ▼ פרטים טכניים                                           │
│  ┌────────────────────────────────────────────────────┐   │
│  │ {                                                  │   │
│  │   "query": { "status": "completed" },              │   │
│  │   "recordCount": 42,                               │   │
│  │   "columns": ["שם", "סכום", "סטטוס", "תאריך"]      │   │
│  │ }                                                  │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│                                            [🗑️ מחק מסמך]   │
└────────────────────────────────────────────────────────────┘
```

---

## Migration

### Apply Migration

```bash
cd /Users/yaronkra/Projects/aitheroad/hkf-crm
npx supabase db push --linked
```

### Create Storage Bucket

Run in Supabase SQL Editor:

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('ai-documents', 'ai-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "ai_documents_storage_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'ai-documents');

CREATE POLICY "ai_documents_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ai-documents');

CREATE POLICY "ai_documents_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'ai-documents');

CREATE POLICY "ai_documents_storage_service" ON storage.objects
  FOR ALL TO service_role
  USING (bucket_id = 'ai-documents')
  WITH CHECK (bucket_id = 'ai-documents');
```

---

## Example Prompts

Users can request documents using natural language:

| Prompt | Result |
|--------|--------|
| "צור דוח תשלומים" | Payment report PDF |
| "ייצא רשימת אנשים ל-CSV" | People list CSV |
| "הכן דוח ראיונות לשבוע הקרוב" | Interview schedule PDF |
| "ייצא את כל התשלומים של ינואר" | Filtered payment CSV |
| "צור דוח משתתפי התוכנית" | Program enrollment PDF |

---

## Troubleshooting

### Document generation fails

1. Check API logs for `[DocumentGenerator]` errors
2. Verify Supabase connection
3. Check if data exists for the query

### Download URL not working

1. URLs expire after 1 hour
2. Check if storage bucket exists
3. Verify RLS policies allow access

### PDF content issues

1. Hebrew text requires proper font
2. Default Helvetica used (may not render Hebrew perfectly)
3. Consider adding Heebo or similar Hebrew font

### CSV encoding issues

1. File includes UTF-8 BOM for Excel compatibility
2. Open in Excel using UTF-8 encoding option
3. Google Sheets should detect encoding automatically

---

## Future Enhancements

1. **Hebrew Font Support** - Add Heebo or Rubik font for proper Hebrew rendering
2. **Charts in PDF** - Add visualization charts using chart.js
3. **Email Documents** - Send documents directly via email
4. **Scheduled Reports** - Auto-generate weekly/monthly reports
5. **Template System** - Predefined report templates
6. **Watermarks** - Add organization branding to PDFs
