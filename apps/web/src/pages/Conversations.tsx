import { useState, useMemo } from "react";
import {
  MessageSquare,
  Clock,
  Archive,
  MoreHorizontal,
  RefreshCw,
  Eye,
  ChevronLeft,
  User,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useConversationsWithDetails,
  useConversation,
  useConversationMessages,
  useArchiveConversation,
  type Conversation,
  type ConversationMessage,
  type ToolCall,
} from "@/hooks/useConversations";

type StatusFilter = "all" | "active" | "archived";

const statusVariants: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  archived: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

const statusLabels: Record<string, string> = {
  active: "פעילה",
  archived: "בארכיון",
};

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("he-IL", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "עכשיו";
  if (diffMins < 60) return `לפני ${diffMins} דקות`;
  if (diffHours < 24) return `לפני ${diffHours} שעות`;
  if (diffDays < 7) return `לפני ${diffDays} ימים`;
  return formatDate(dateString);
}

function getInitials(email: string | null | undefined): string {
  if (!email) return "AI";
  const parts = email.split("@")[0].split(".");
  return parts.map((p) => p.charAt(0)).join("").toUpperCase().slice(0, 2);
}

function getAvatarColor(email: string | null | undefined): string {
  if (!email) return "bg-gray-500";
  const colors = [
    "bg-blue-500",
    "bg-green-500",
    "bg-purple-500",
    "bg-orange-500",
    "bg-pink-500",
    "bg-teal-500",
  ];
  const hash = email.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

interface ConversationsProps {
  onSelectPerson?: (personId: string) => void;
}

export function Conversations({ onSelectPerson }: ConversationsProps) {
  const { data: conversations, isLoading, refetch } = useConversationsWithDetails();
  const archiveConversation = useArchiveConversation();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);

  // Filter conversations based on selected tab
  const filteredConversations = useMemo(() => {
    if (!conversations) return [];
    if (statusFilter === "all") return conversations;
    return conversations.filter((conv) => conv.status === statusFilter);
  }, [conversations, statusFilter]);

  // Stats
  const stats = useMemo(() => {
    if (!conversations) return { total: 0, active: 0, archived: 0, messages: 0 };
    return {
      total: conversations.length,
      active: conversations.filter((c) => c.status === "active").length,
      archived: conversations.filter((c) => c.status === "archived").length,
      messages: conversations.reduce((sum, c) => sum + (c.message_count || 0), 0),
    };
  }, [conversations]);

  const handleArchive = (conv: Conversation) => {
    archiveConversation.mutate(conv.id);
  };

  // If a conversation is selected, show the viewer
  if (selectedConversation) {
    return (
      <ConversationViewer
        conversationId={selectedConversation.id}
        onBack={() => setSelectedConversation(null)}
        onSelectPerson={onSelectPerson}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">שיחות AI</h1>
          <p className="text-sm text-muted-foreground mt-1">
            צפייה במעקב אחר שיחות עם נועם
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-full">
                <MessageSquare className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-sm text-muted-foreground">סה"כ שיחות</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/10 rounded-full">
                <Clock className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.active}</div>
                <div className="text-sm text-muted-foreground">פעילות</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gray-500/10 rounded-full">
                <Archive className="w-5 h-5 text-gray-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.archived}</div>
                <div className="text-sm text-muted-foreground">בארכיון</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-500/10 rounded-full">
                <MessageSquare className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.messages}</div>
                <div className="text-sm text-muted-foreground">סה"כ הודעות</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Conversations Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-base">
            רשימת שיחות {filteredConversations?.length ? `(${filteredConversations.length})` : ""}
          </CardTitle>
          <Tabs
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as StatusFilter)}
            className="w-auto"
          >
            <TabsList className="h-8">
              <TabsTrigger value="all" className="text-xs px-3">
                הכל
              </TabsTrigger>
              <TabsTrigger value="active" className="text-xs px-3">
                פעילות
              </TabsTrigger>
              <TabsTrigger value="archived" className="text-xs px-3">
                ארכיון
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">טוען שיחות...</div>
          ) : !filteredConversations?.length ? (
            <div className="p-8 text-center text-muted-foreground">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>אין שיחות בסטטוס זה</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs uppercase tracking-wide font-semibold">
                    משתמש
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide font-semibold">
                    התחלה
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide font-semibold">
                    עדכון אחרון
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide font-semibold">
                    הודעות
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide font-semibold">
                    סטטוס
                  </TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredConversations.map((conversation) => (
                  <TableRow
                    key={conversation.id}
                    className="hover:bg-muted/50 cursor-pointer"
                    onClick={() => setSelectedConversation(conversation)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback
                            className={`${getAvatarColor(conversation.user_email)} text-white text-xs`}
                          >
                            {getInitials(conversation.user_email)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">
                            {conversation.user_email || "משתמש אנונימי"}
                          </div>
                          {conversation.person_name && (
                            <div className="text-xs text-muted-foreground">
                              קשור ל: {conversation.person_name}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{formatDate(conversation.started_at)}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {formatRelativeTime(conversation.last_message_at)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{conversation.message_count || 0}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={statusVariants[conversation.status] || statusVariants.active}
                      >
                        {statusLabels[conversation.status] || conversation.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedConversation(conversation);
                            }}
                          >
                            <Eye className="w-4 h-4 ml-2" />
                            צפה בשיחה
                          </DropdownMenuItem>
                          {conversation.person_id && (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectPerson?.(conversation.person_id!);
                              }}
                            >
                              <User className="w-4 h-4 ml-2" />
                              צפה באיש קשר
                            </DropdownMenuItem>
                          )}
                          {conversation.status === "active" && (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleArchive(conversation);
                              }}
                            >
                              <Archive className="w-4 h-4 ml-2" />
                              העבר לארכיון
                            </DropdownMenuItem>
                          )}
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
    </div>
  );
}

// ============================================================================
// Conversation Viewer Component
// ============================================================================

interface ConversationViewerProps {
  conversationId: string;
  onBack: () => void;
  onSelectPerson?: (personId: string) => void;
}

function ConversationViewer({
  conversationId,
  onBack,
  onSelectPerson,
}: ConversationViewerProps) {
  const { data: conversation, isLoading: convLoading } = useConversation(conversationId);
  const { data: messages, isLoading: msgsLoading } = useConversationMessages(conversationId);
  const archiveConversation = useArchiveConversation();

  const isLoading = convLoading || msgsLoading;

  if (isLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        טוען שיחה...
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        שיחה לא נמצאה
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">
              שיחה עם {conversation.user_email || "משתמש אנונימי"}
            </h1>
            <p className="text-sm text-muted-foreground">
              התחלה: {formatDate(conversation.started_at)} | הודעות:{" "}
              {conversation.message_count}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="secondary"
            className={statusVariants[conversation.status] || statusVariants.active}
          >
            {statusLabels[conversation.status] || conversation.status}
          </Badge>
          {conversation.status === "active" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => archiveConversation.mutate(conversation.id)}
            >
              <Archive className="w-4 h-4 ml-2" />
              העבר לארכיון
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <Card>
        <CardContent className="p-0">
          <div className="h-[600px] overflow-y-auto p-4">
            <div className="space-y-4">
              {messages?.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  userEmail={conversation.user_email}
                />
              ))}
              {(!messages || messages.length === 0) && (
                <div className="text-center text-muted-foreground py-8">
                  אין הודעות בשיחה זו
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Message Bubble Component
// ============================================================================

interface MessageBubbleProps {
  message: ConversationMessage;
  userEmail: string | null;
}

function MessageBubble({ message, userEmail }: MessageBubbleProps) {
  const [showTools, setShowTools] = useState(false);
  const isUser = message.role === "user";
  const hasTools = message.tool_calls && message.tool_calls.length > 0;

  return (
    <div className={`flex ${isUser ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[80%] rounded-lg p-3 ${
          isUser
            ? "bg-muted text-foreground"
            : "bg-primary text-primary-foreground"
        }`}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs opacity-70">
            {isUser ? userEmail || "משתמש" : "נועם (AI)"}
          </span>
          <span className="text-xs opacity-50">
            {new Date(message.created_at).toLocaleTimeString("he-IL", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>

        {/* Content */}
        <div className="whitespace-pre-wrap">{message.content || "(ללא תוכן טקסט)"}</div>

        {/* Tool calls */}
        {hasTools && (
          <div className="mt-2 pt-2 border-t border-current/20">
            <button
              onClick={() => setShowTools(!showTools)}
              className="flex items-center gap-1 text-xs opacity-70 hover:opacity-100"
            >
              <Wrench className="w-3 h-3" />
              <span>כלים שהופעלו ({message.tool_calls?.length})</span>
            </button>
            {showTools && (
              <div className="mt-2 space-y-2">
                {message.tool_calls?.map((tc: ToolCall, idx: number) => {
                  const result = message.tool_results?.find(
                    (tr) => tr.toolUseId === tc.id
                  );
                  return (
                    <div
                      key={tc.id || idx}
                      className="text-xs bg-black/10 rounded p-2"
                    >
                      <div className="font-mono font-semibold">{tc.name}</div>
                      <div className="opacity-70 mt-1">
                        קלט: {JSON.stringify(tc.input, null, 2).slice(0, 200)}
                        {JSON.stringify(tc.input).length > 200 && "..."}
                      </div>
                      {result && (
                        <div
                          className={`mt-1 ${result.isError ? "text-red-300" : "text-green-300"}`}
                        >
                          {result.isError ? "שגיאה" : "תוצאה"}:{" "}
                          {JSON.stringify(result.result, null, 2).slice(0, 200)}
                          {JSON.stringify(result.result).length > 200 && "..."}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Conversations;
