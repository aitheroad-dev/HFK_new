import { createRequire } from 'module';
import { createClient } from '@supabase/supabase-js';
import { db, aiDocuments, people, payments, programs, enrollments, interviews, events } from '@generic-ai-crm/db';
import { eq, and, desc } from 'drizzle-orm';
import type { DocumentType, DocumentFormat, DocumentMetadata } from '@generic-ai-crm/db';

// Use createRequire to load CommonJS module in ESM context
const require = createRequire(import.meta.url);
const PDFDocument = require('pdfkit');

// Initialize Supabase client for storage
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
);

const STORAGE_BUCKET = 'ai-documents';

/**
 * Document generation input
 */
export interface GenerateDocumentInput {
  title: string;
  description?: string;
  documentType: DocumentType;
  format: DocumentFormat;
  data: Record<string, unknown>[];
  columns?: Array<{ key: string; label: string }>;
  options?: {
    dateRange?: { from?: string; to?: string };
    filters?: Record<string, unknown>;
  };
  conversationId?: string;
  userInfo?: {
    userId?: string;
    userEmail?: string;
  };
}

/**
 * Document generation result
 */
export interface GenerateDocumentResult {
  success: boolean;
  documentId?: string;
  fileName?: string;
  storagePath?: string;
  downloadUrl?: string;
  fileSize?: number;
  error?: string;
}

/**
 * Generate a PDF document from data
 */
async function generatePdf(
  title: string,
  data: Record<string, unknown>[],
  columns: Array<{ key: string; label: string }>,
  options?: Record<string, unknown>
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        bufferPages: true,
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Register Hebrew font (using built-in Helvetica as fallback)
      // For RTL Hebrew support, you'd need to add a Hebrew font like Heebo
      doc.font('Helvetica');

      // Title
      doc.fontSize(20)
        .text(title, { align: 'center' })
        .moveDown(0.5);

      // Generation date
      doc.fontSize(10)
        .fillColor('#666666')
        .text(`Generated: ${new Date().toLocaleDateString('he-IL')} ${new Date().toLocaleTimeString('he-IL')}`, { align: 'center' })
        .moveDown(1);

      // Reset color
      doc.fillColor('#000000');

      // Table header
      const pageWidth = doc.page.width - 100;
      const colWidth = pageWidth / columns.length;
      let y = doc.y;

      // Header background
      doc.rect(50, y, pageWidth, 20)
        .fill('#f0f0f0');

      doc.fillColor('#000000').fontSize(10);
      columns.forEach((col, i) => {
        doc.text(col.label, 55 + i * colWidth, y + 5, {
          width: colWidth - 10,
          align: 'left',
        });
      });

      y += 25;
      doc.y = y;

      // Table rows
      for (const row of data) {
        // Check if we need a new page
        if (doc.y > doc.page.height - 70) {
          doc.addPage();
          y = 50;
          doc.y = y;
        }

        y = doc.y;
        columns.forEach((col, i) => {
          const value = row[col.key];
          const displayValue = formatValue(value);
          doc.text(displayValue, 55 + i * colWidth, y, {
            width: colWidth - 10,
            align: 'left',
          });
        });
        doc.moveDown(0.3);

        // Draw row separator
        doc.strokeColor('#e0e0e0')
          .lineWidth(0.5)
          .moveTo(50, doc.y)
          .lineTo(50 + pageWidth, doc.y)
          .stroke();

        doc.moveDown(0.3);
      }

      // Summary
      doc.moveDown(1)
        .fontSize(10)
        .fillColor('#666666')
        .text(`Total records: ${data.length}`, { align: 'right' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generate a CSV document from data
 */
function generateCsv(
  data: Record<string, unknown>[],
  columns: Array<{ key: string; label: string }>
): Buffer {
  // BOM for Excel UTF-8 compatibility
  let csv = '\ufeff';

  // Header row
  csv += columns.map(col => escapeCSV(col.label)).join(',') + '\n';

  // Data rows
  for (const row of data) {
    const values = columns.map(col => {
      const value = row[col.key];
      return escapeCSV(formatValue(value));
    });
    csv += values.join(',') + '\n';
  }

  return Buffer.from(csv, 'utf-8');
}

/**
 * Escape a value for CSV format
 */
function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Format a value for display
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (value instanceof Date) {
    return value.toLocaleDateString('he-IL');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Upload file to Supabase Storage
 */
async function uploadToStorage(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  organizationId: string
): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const storagePath = `${organizationId}/${Date.now()}_${fileName}`;

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (error) {
      // If bucket doesn't exist, try to create it
      if (error.message?.includes('Bucket not found') || error.message?.includes('not found')) {
        console.log('[DocumentGenerator] Storage bucket not found, documents will be stored in DB only');
        return { success: false, error: 'Storage bucket not configured' };
      }
      throw error;
    }

    return { success: true, path: storagePath };
  } catch (error) {
    console.error('[DocumentGenerator] Upload error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Upload failed' };
  }
}

/**
 * Get a signed download URL for a document
 */
export async function getDocumentDownloadUrl(storagePath: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, 3600); // 1 hour expiry

    if (error) throw error;
    return data.signedUrl;
  } catch (error) {
    console.error('[DocumentGenerator] Failed to get download URL:', error);
    return null;
  }
}

/**
 * Get default columns for a document type
 */
function getDefaultColumns(documentType: DocumentType): Array<{ key: string; label: string }> {
  switch (documentType) {
    case 'payment_report':
      return [
        { key: 'personName', label: 'שם' },
        { key: 'amount', label: 'סכום' },
        { key: 'status', label: 'סטטוס' },
        { key: 'paidAt', label: 'תאריך' },
        { key: 'description', label: 'תיאור' },
      ];
    case 'people_list':
      return [
        { key: 'firstName', label: 'שם פרטי' },
        { key: 'lastName', label: 'שם משפחה' },
        { key: 'email', label: 'אימייל' },
        { key: 'phone', label: 'טלפון' },
        { key: 'status', label: 'סטטוס' },
      ];
    case 'program_report':
      return [
        { key: 'programName', label: 'תוכנית' },
        { key: 'personName', label: 'משתתף' },
        { key: 'status', label: 'סטטוס' },
        { key: 'appliedAt', label: 'הגשה' },
        { key: 'enrolledAt', label: 'הרשמה' },
      ];
    case 'interview_schedule':
      return [
        { key: 'personName', label: 'מועמד' },
        { key: 'programName', label: 'תוכנית' },
        { key: 'scheduledAt', label: 'תאריך' },
        { key: 'status', label: 'סטטוס' },
        { key: 'outcome', label: 'תוצאה' },
      ];
    case 'event_summary':
      return [
        { key: 'name', label: 'אירוע' },
        { key: 'startsAt', label: 'תאריך' },
        { key: 'registrationCount', label: 'נרשמים' },
        { key: 'location', label: 'מיקום' },
        { key: 'status', label: 'סטטוס' },
      ];
    default:
      return [
        { key: 'id', label: 'מזהה' },
        { key: 'name', label: 'שם' },
        { key: 'value', label: 'ערך' },
      ];
  }
}

/**
 * Main document generation function
 */
export async function generateDocument(
  input: GenerateDocumentInput,
  organizationId: string
): Promise<GenerateDocumentResult> {
  const {
    title,
    description,
    documentType,
    format,
    data,
    columns = getDefaultColumns(documentType),
    options,
    conversationId,
    userInfo,
  } = input;

  console.log(`[DocumentGenerator] Generating ${format} document: ${title}`);
  console.log(`[DocumentGenerator] Data rows: ${data.length}`);

  try {
    // Create document record with 'generating' status
    const [docRecord] = await db
      .insert(aiDocuments)
      .values({
        organizationId,
        conversationId: conversationId || null,
        title,
        description: description || null,
        documentType,
        format,
        status: 'generating',
        metadata: {
          query: options?.filters,
          recordCount: data.length,
          columns: columns.map(c => c.label),
          options: options,
        } as DocumentMetadata,
        createdByUserId: userInfo?.userId || null,
        createdByEmail: userInfo?.userEmail || null,
      })
      .returning();

    const documentId = docRecord.id;

    // Generate the file
    let buffer: Buffer;
    let mimeType: string;
    let extension: string;

    if (format === 'pdf') {
      buffer = await generatePdf(title, data, columns, options);
      mimeType = 'application/pdf';
      extension = 'pdf';
    } else {
      buffer = generateCsv(data, columns);
      mimeType = 'text/csv';
      extension = 'csv';
    }

    const fileName = `${title.replace(/[^a-zA-Z0-9\u0590-\u05FF]/g, '_')}_${Date.now()}.${extension}`;
    const fileSize = buffer.length;

    // Upload to storage
    const uploadResult = await uploadToStorage(buffer, fileName, mimeType, organizationId);

    // Update document record
    if (uploadResult.success) {
      await db
        .update(aiDocuments)
        .set({
          status: 'ready',
          storagePath: uploadResult.path,
          fileName,
          fileSize,
          mimeType,
          updatedAt: new Date(),
        })
        .where(eq(aiDocuments.id, documentId));

      const downloadUrl = await getDocumentDownloadUrl(uploadResult.path!);

      console.log(`[DocumentGenerator] Document ready: ${documentId}`);
      return {
        success: true,
        documentId,
        fileName,
        storagePath: uploadResult.path,
        downloadUrl: downloadUrl || undefined,
        fileSize,
      };
    } else {
      // Storage failed but we still have the document in DB
      // Mark as ready but without storage path
      await db
        .update(aiDocuments)
        .set({
          status: 'ready',
          fileName,
          fileSize,
          mimeType,
          metadata: {
            ...docRecord.metadata,
            storageError: uploadResult.error,
          } as DocumentMetadata,
          updatedAt: new Date(),
        })
        .where(eq(aiDocuments.id, documentId));

      console.log(`[DocumentGenerator] Document ready (no storage): ${documentId}`);
      return {
        success: true,
        documentId,
        fileName,
        fileSize,
        error: `Document created but not uploaded to storage: ${uploadResult.error}`,
      };
    }
  } catch (error) {
    console.error('[DocumentGenerator] Error:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate document',
    };
  }
}

/**
 * Get document by ID
 */
export async function getDocument(documentId: string, organizationId: string) {
  const result = await db
    .select()
    .from(aiDocuments)
    .where(and(eq(aiDocuments.id, documentId), eq(aiDocuments.organizationId, organizationId)))
    .limit(1);

  return result[0] || null;
}

/**
 * List documents
 */
export async function listDocuments(
  organizationId: string,
  options?: {
    status?: string;
    documentType?: DocumentType;
    limit?: number;
    offset?: number;
  }
) {
  const conditions = [eq(aiDocuments.organizationId, organizationId)];

  if (options?.status) {
    conditions.push(eq(aiDocuments.status, options.status as 'generating' | 'ready' | 'failed' | 'archived'));
  }

  if (options?.documentType) {
    conditions.push(eq(aiDocuments.documentType, options.documentType));
  }

  const results = await db
    .select()
    .from(aiDocuments)
    .where(and(...conditions))
    .orderBy(desc(aiDocuments.createdAt))
    .limit(options?.limit || 50)
    .offset(options?.offset || 0);

  return results;
}

/**
 * Archive a document
 */
export async function archiveDocument(documentId: string, organizationId: string) {
  const result = await db
    .update(aiDocuments)
    .set({ status: 'archived', updatedAt: new Date() })
    .where(and(eq(aiDocuments.id, documentId), eq(aiDocuments.organizationId, organizationId)))
    .returning();

  return result[0] || null;
}
