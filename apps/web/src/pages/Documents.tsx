import { useState } from "react";
import {
  FileText,
  Download,
  Trash2,
  Archive,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useDocumentsWithUrls,
  useArchiveDocument,
  useDeleteDocument,
  useDocumentStats,
  formatFileSize,
  getDocumentTypeLabel,
  getDocumentStatusLabel,
  type DocumentWithDetails,
  type DocumentStatus,
} from "@/hooks/useDocuments";

interface DocumentsProps {
  onSelectConversation?: (conversationId: string) => void;
}

export function Documents({ onSelectConversation }: DocumentsProps) {
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | "all">("all");
  const [selectedDocument, setSelectedDocument] = useState<DocumentWithDetails | null>(null);

  // Queries
  const {
    data: documents,
    isLoading,
    refetch,
  } = useDocumentsWithUrls({
    status: statusFilter === "all" ? "all" : statusFilter,
    limit: 100,
  });
  const { data: stats } = useDocumentStats();

  // Mutations
  const archiveDocument = useArchiveDocument();
  const deleteDocument = useDeleteDocument();

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("he-IL", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Get relative time
  const getRelativeTime = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return "עכשיו";
    if (minutes < 60) return `לפני ${minutes} דקות`;
    if (hours < 24) return `לפני ${hours} שעות`;
    if (days === 1) return "אתמול";
    if (days < 7) return `לפני ${days} ימים`;
    return formatDate(dateStr);
  };

  // Get status badge color
  const getStatusColor = (status: DocumentStatus) => {
    switch (status) {
      case "ready":
        return "bg-green-100 text-green-800";
      case "generating":
        return "bg-blue-100 text-blue-800";
      case "failed":
        return "bg-red-100 text-red-800";
      case "archived":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Get format icon
  const getFormatIcon = (format: string) => {
    if (format === "csv") {
      return <FileSpreadsheet className="w-4 h-4 text-green-600" />;
    }
    return <FileText className="w-4 h-4 text-red-600" />;
  };

  // Handle download
  const handleDownload = (doc: DocumentWithDetails) => {
    if (doc.download_url) {
      window.open(doc.download_url, "_blank");
    }
  };

  // Handle archive
  const handleArchive = (doc: DocumentWithDetails) => {
    archiveDocument.mutate(doc.id);
  };

  // Handle delete
  const handleDelete = (doc: DocumentWithDetails) => {
    if (window.confirm("האם אתה בטוח שברצונך למחוק את המסמך?")) {
      deleteDocument.mutate(doc.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">מסמכים</h1>
          <p className="text-muted-foreground">
            מסמכים ודוחות שנוצרו על ידי AI
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 ml-2" />
          רענן
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              סה"כ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              מוכנים
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats?.ready || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              בארכיון
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-500">
              {stats?.archived || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              PDF
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {stats?.pdfCount || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              CSV
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              {stats?.csvCount || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Content */}
      {selectedDocument ? (
        // Document Detail View
        <DocumentDetail
          document={selectedDocument}
          onBack={() => setSelectedDocument(null)}
          onDownload={handleDownload}
          onArchive={handleArchive}
          onDelete={handleDelete}
          onGoToConversation={onSelectConversation}
        />
      ) : (
        // Documents List
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>רשימת מסמכים</CardTitle>

              {/* Status Filter */}
              <div className="flex gap-2">
                <Button
                  variant={statusFilter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter("all")}
                >
                  הכל
                </Button>
                <Button
                  variant={statusFilter === "ready" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter("ready")}
                >
                  מוכנים
                </Button>
                <Button
                  variant={statusFilter === "archived" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter("archived")}
                >
                  ארכיון
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                טוען מסמכים...
              </div>
            ) : !documents?.length ? (
              <div className="text-center py-8 text-muted-foreground">
                אין מסמכים
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">כותרת</TableHead>
                    <TableHead className="text-right">סוג</TableHead>
                    <TableHead className="text-right">פורמט</TableHead>
                    <TableHead className="text-right">גודל</TableHead>
                    <TableHead className="text-right">נוצר</TableHead>
                    <TableHead className="text-right">סטטוס</TableHead>
                    <TableHead className="text-right">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc) => (
                    <TableRow
                      key={doc.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedDocument(doc)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {getFormatIcon(doc.format)}
                          <span>{doc.title}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getDocumentTypeLabel(doc.document_type)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="uppercase">
                          {doc.format}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatFileSize(doc.file_size)}</TableCell>
                      <TableCell>{getRelativeTime(doc.created_at)}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(doc.status)}>
                          {getDocumentStatusLabel(doc.status)}
                        </Badge>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <ChevronDown className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {doc.download_url && (
                              <DropdownMenuItem
                                onClick={() => handleDownload(doc)}
                              >
                                <Download className="w-4 h-4 ml-2" />
                                הורד
                              </DropdownMenuItem>
                            )}
                            {doc.status !== "archived" && (
                              <DropdownMenuItem
                                onClick={() => handleArchive(doc)}
                              >
                                <Archive className="w-4 h-4 ml-2" />
                                העבר לארכיון
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => handleDelete(doc)}
                              className="text-red-600"
                            >
                              <Trash2 className="w-4 h-4 ml-2" />
                              מחק
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Document Detail Component
function DocumentDetail({
  document,
  onBack,
  onDownload,
  onArchive,
  onDelete,
  onGoToConversation,
}: {
  document: DocumentWithDetails;
  onBack: () => void;
  onDownload: (doc: DocumentWithDetails) => void;
  onArchive: (doc: DocumentWithDetails) => void;
  onDelete: (doc: DocumentWithDetails) => void;
  onGoToConversation?: (id: string) => void;
}) {
  const [showMetadata, setShowMetadata] = useState(false);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowRight className="w-4 h-4 ml-2" />
              חזרה
            </Button>
            <div>
              <CardTitle className="flex items-center gap-2">
                {document.format === "csv" ? (
                  <FileSpreadsheet className="w-5 h-5 text-green-600" />
                ) : (
                  <FileText className="w-5 h-5 text-red-600" />
                )}
                {document.title}
              </CardTitle>
              {document.description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {document.description}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge className={document.status === "ready" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
              {getDocumentStatusLabel(document.status)}
            </Badge>

            {document.download_url && (
              <Button onClick={() => onDownload(document)}>
                <Download className="w-4 h-4 ml-2" />
                הורד
              </Button>
            )}

            {document.status !== "archived" && (
              <Button variant="outline" onClick={() => onArchive(document)}>
                <Archive className="w-4 h-4 ml-2" />
                ארכיון
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Document Info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-muted-foreground">סוג מסמך</div>
            <div className="font-medium">{getDocumentTypeLabel(document.document_type)}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">פורמט</div>
            <div className="font-medium uppercase">{document.format}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">גודל</div>
            <div className="font-medium">{formatFileSize(document.file_size)}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">נוצר על ידי</div>
            <div className="font-medium">{document.created_by_email || "-"}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-muted-foreground">תאריך יצירה</div>
            <div className="font-medium">
              {new Date(document.created_at).toLocaleDateString("he-IL", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">שם קובץ</div>
            <div className="font-medium text-sm truncate">{document.file_name || "-"}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">רשומות</div>
            <div className="font-medium">
              {document.metadata?.recordCount || "-"}
            </div>
          </div>
          {document.conversation_id && (
            <div>
              <div className="text-sm text-muted-foreground">שיחה מקושרת</div>
              <Button
                variant="link"
                className="p-0 h-auto font-medium"
                onClick={() => onGoToConversation?.(document.conversation_id!)}
              >
                עבור לשיחה
                <ExternalLink className="w-3 h-3 mr-1" />
              </Button>
            </div>
          )}
        </div>

        {/* Metadata */}
        {document.metadata && (
          <div className="border-t pt-4">
            <Button
              variant="ghost"
              className="flex items-center gap-2"
              onClick={() => setShowMetadata(!showMetadata)}
            >
              {showMetadata ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
              פרטים טכניים
            </Button>

            {showMetadata && (
              <div className="mt-4 bg-muted rounded-lg p-4">
                <pre className="text-sm overflow-x-auto" dir="ltr">
                  {JSON.stringify(document.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Delete Button */}
        <div className="border-t pt-4 flex justify-end">
          <Button variant="destructive" onClick={() => onDelete(document)}>
            <Trash2 className="w-4 h-4 ml-2" />
            מחק מסמך
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default Documents;
