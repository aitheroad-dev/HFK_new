import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

/**
 * Document types that can be generated
 */
export type DocumentType =
  | "payment_report"
  | "people_list"
  | "program_report"
  | "interview_schedule"
  | "event_summary"
  | "custom_report";

/**
 * Document format
 */
export type DocumentFormat = "pdf" | "csv";

/**
 * Document status
 */
export type DocumentStatus = "generating" | "ready" | "failed" | "archived";

/**
 * Document metadata
 */
export interface DocumentMetadata {
  query?: Record<string, unknown>;
  recordCount?: number;
  columns?: string[];
  error?: string;
  options?: Record<string, unknown>;
  storageError?: string;
}

/**
 * AI Document from database
 */
export interface Document {
  id: string;
  organization_id: string;
  conversation_id: string | null;
  title: string;
  description: string | null;
  document_type: DocumentType;
  format: DocumentFormat;
  storage_path: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  status: DocumentStatus;
  metadata: DocumentMetadata | null;
  created_by_user_id: string | null;
  created_by_email: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Document with additional details
 */
export interface DocumentWithDetails extends Document {
  conversation_title?: string;
  download_url?: string;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number | null): string {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Get Hebrew label for document type
 */
export function getDocumentTypeLabel(type: DocumentType): string {
  switch (type) {
    case "payment_report":
      return "דוח תשלומים";
    case "people_list":
      return "רשימת אנשים";
    case "program_report":
      return "דוח תוכנית";
    case "interview_schedule":
      return "לוח ראיונות";
    case "event_summary":
      return "סיכום אירועים";
    case "custom_report":
      return "דוח מותאם";
    default:
      return type;
  }
}

/**
 * Get Hebrew label for document status
 */
export function getDocumentStatusLabel(status: DocumentStatus): string {
  switch (status) {
    case "generating":
      return "בהכנה";
    case "ready":
      return "מוכן";
    case "failed":
      return "נכשל";
    case "archived":
      return "בארכיון";
    default:
      return status;
  }
}

/**
 * Fetch all documents with pagination
 */
export function useDocuments(options?: {
  status?: DocumentStatus | "all";
  documentType?: DocumentType;
  limit?: number;
  offset?: number;
}) {
  const { status = "all", documentType, limit = 50, offset = 0 } = options || {};

  return useQuery({
    queryKey: ["documents", status, documentType, limit, offset],
    queryFn: async () => {
      let query = supabase
        .from("ai_documents")
        .select("*")
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (status !== "all") {
        query = query.eq("status", status);
      }

      if (documentType) {
        query = query.eq("document_type", documentType);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Document[];
    },
  });
}

/**
 * Fetch documents with download URLs
 */
export function useDocumentsWithUrls(options?: {
  status?: DocumentStatus | "all";
  limit?: number;
}) {
  const { status = "all", limit = 50 } = options || {};

  return useQuery({
    queryKey: ["documents-with-urls", status, limit],
    queryFn: async () => {
      // Get documents
      let query = supabase
        .from("ai_documents")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (status !== "all") {
        query = query.eq("status", status);
      }

      const { data: documents, error: docError } = await query;

      if (docError) throw docError;

      // Get download URLs for documents with storage paths
      const docsWithUrls: DocumentWithDetails[] = [];

      for (const doc of documents || []) {
        let downloadUrl: string | undefined;

        if (doc.storage_path) {
          const { data: urlData } = await supabase.storage
            .from("ai-documents")
            .createSignedUrl(doc.storage_path, 3600); // 1 hour expiry

          downloadUrl = urlData?.signedUrl;
        }

        docsWithUrls.push({
          ...doc,
          download_url: downloadUrl,
        });
      }

      return docsWithUrls;
    },
  });
}

/**
 * Fetch a single document by ID
 */
export function useDocument(documentId: string | undefined) {
  return useQuery({
    queryKey: ["document", documentId],
    queryFn: async () => {
      if (!documentId) return null;

      const { data, error } = await supabase
        .from("ai_documents")
        .select("*")
        .eq("id", documentId)
        .single();

      if (error) throw error;

      // Get download URL
      let downloadUrl: string | undefined;
      if (data?.storage_path) {
        const { data: urlData } = await supabase.storage
          .from("ai-documents")
          .createSignedUrl(data.storage_path, 3600);

        downloadUrl = urlData?.signedUrl;
      }

      return {
        ...data,
        download_url: downloadUrl,
      } as DocumentWithDetails;
    },
    enabled: !!documentId,
  });
}

/**
 * Archive a document
 */
export function useArchiveDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (documentId: string) => {
      const { data, error } = await supabase
        .from("ai_documents")
        .update({ status: "archived", updated_at: new Date().toISOString() })
        .eq("id", documentId)
        .select()
        .single();

      if (error) throw error;
      return data as Document;
    },
    onSuccess: (_, documentId) => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["documents-with-urls"] });
      queryClient.invalidateQueries({ queryKey: ["document", documentId] });
      queryClient.invalidateQueries({ queryKey: ["document-stats"] });
    },
  });
}

/**
 * Delete a document
 */
export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (documentId: string) => {
      // First get the document to find storage path
      const { data: doc } = await supabase
        .from("ai_documents")
        .select("storage_path")
        .eq("id", documentId)
        .single();

      // Delete from storage if exists
      if (doc?.storage_path) {
        await supabase.storage
          .from("ai-documents")
          .remove([doc.storage_path]);
      }

      // Delete from database
      const { error } = await supabase
        .from("ai_documents")
        .delete()
        .eq("id", documentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["documents-with-urls"] });
      queryClient.invalidateQueries({ queryKey: ["document-stats"] });
    },
  });
}

/**
 * Get document statistics
 */
export function useDocumentStats() {
  return useQuery({
    queryKey: ["document-stats"],
    queryFn: async () => {
      // Get counts by status
      const { count: total } = await supabase
        .from("ai_documents")
        .select("id", { count: "exact", head: true });

      const { count: ready } = await supabase
        .from("ai_documents")
        .select("id", { count: "exact", head: true })
        .eq("status", "ready");

      const { count: archived } = await supabase
        .from("ai_documents")
        .select("id", { count: "exact", head: true })
        .eq("status", "archived");

      const { count: pdfCount } = await supabase
        .from("ai_documents")
        .select("id", { count: "exact", head: true })
        .eq("format", "pdf")
        .eq("status", "ready");

      const { count: csvCount } = await supabase
        .from("ai_documents")
        .select("id", { count: "exact", head: true })
        .eq("format", "csv")
        .eq("status", "ready");

      return {
        total: total || 0,
        ready: ready || 0,
        archived: archived || 0,
        pdfCount: pdfCount || 0,
        csvCount: csvCount || 0,
      };
    },
  });
}
