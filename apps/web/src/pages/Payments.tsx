import { useState, useMemo } from "react";
import {
  CreditCard,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  MoreHorizontal,
  RefreshCw,
  User,
  Mail,
  Receipt,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  usePayments,
  usePaymentStats,
  useCompletePayment,
  useCancelPayment,
  type PaymentWithDetails,
} from "@/hooks/usePayments";

type StatusFilter = "all" | "pending" | "completed" | "cancelled";

const statusVariants: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  refunded: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

const statusLabels: Record<string, string> = {
  pending: "ממתין",
  completed: "שולם",
  failed: "נכשל",
  refunded: "הוחזר",
  cancelled: "בוטל",
};

const paymentMethodLabels: Record<string, string> = {
  credit_card: "כרטיס אשראי",
  bank_transfer: "העברה בנקאית",
  cash: "מזומן",
  check: "צ'ק",
};

function formatCurrency(amount: number, currency: string = "ILS"): string {
  const formatter = new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  });
  return formatter.format(amount / 100); // Amount is in cents
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("he-IL", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getInitials(name: string): string {
  const parts = name.split(" ");
  return parts.map((p) => p.charAt(0)).join("").toUpperCase().slice(0, 2);
}

interface PaymentsProps {
  onSelectPerson?: (personId: string) => void;
}

export function Payments({ onSelectPerson }: PaymentsProps) {
  const { data: payments, isLoading, refetch } = usePayments();
  const { data: stats, isLoading: statsLoading } = usePaymentStats();
  const completePayment = useCompletePayment();
  const cancelPayment = useCancelPayment();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [completingPayment, setCompletingPayment] = useState<PaymentWithDetails | null>(null);
  const [cancellingPayment, setCancellingPayment] = useState<PaymentWithDetails | null>(null);

  // Filter payments based on selected tab
  const filteredPayments = useMemo(() => {
    if (!payments) return [];
    if (statusFilter === "all") return payments;
    return payments.filter((payment) => payment.status === statusFilter);
  }, [payments, statusFilter]);

  const handleCompletePayment = () => {
    if (completingPayment) {
      completePayment.mutate(completingPayment.id, {
        onSuccess: () => setCompletingPayment(null),
      });
    }
  };

  const handleCancelPayment = () => {
    if (cancellingPayment) {
      cancelPayment.mutate(cancellingPayment.id, {
        onSuccess: () => setCancellingPayment(null),
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">תשלומים</h1>
          <p className="text-sm text-muted-foreground mt-1">
            מעקב אחר תשלומים והכנסות
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
              <div className="p-3 bg-green-500/10 rounded-full">
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
              <div>
                {statsLoading ? (
                  <div className="h-8 w-20 bg-muted animate-pulse rounded" />
                ) : (
                  <div className="text-2xl font-bold">
                    {formatCurrency(stats?.totalCompleted || 0)}
                  </div>
                )}
                <div className="text-sm text-muted-foreground">סה"כ שולם</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-yellow-500/10 rounded-full">
                <Clock className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                {statsLoading ? (
                  <div className="h-8 w-20 bg-muted animate-pulse rounded" />
                ) : (
                  <div className="text-2xl font-bold">
                    {formatCurrency(stats?.totalPending || 0)}
                  </div>
                )}
                <div className="text-sm text-muted-foreground">ממתין לתשלום</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-full">
                <TrendingUp className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                {statsLoading ? (
                  <div className="h-8 w-20 bg-muted animate-pulse rounded" />
                ) : (
                  <div className="text-2xl font-bold">
                    {formatCurrency(stats?.thisMonthTotal || 0)}
                  </div>
                )}
                <div className="text-sm text-muted-foreground">החודש</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <Receipt className="w-5 h-5 text-primary" />
              </div>
              <div>
                {statsLoading ? (
                  <div className="h-8 w-16 bg-muted animate-pulse rounded" />
                ) : (
                  <div className="text-2xl font-bold">{stats?.completedCount || 0}</div>
                )}
                <div className="text-sm text-muted-foreground">תשלומים</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payments Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-base">
            רשימת תשלומים {filteredPayments?.length ? `(${filteredPayments.length})` : ""}
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
              <TabsTrigger value="pending" className="text-xs px-3">
                ממתינים
              </TabsTrigger>
              <TabsTrigger value="completed" className="text-xs px-3">
                שולמו
              </TabsTrigger>
              <TabsTrigger value="cancelled" className="text-xs px-3">
                בוטלו
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">טוען תשלומים...</div>
          ) : !filteredPayments?.length ? (
            <div className="p-8 text-center text-muted-foreground">
              <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>אין תשלומים בסטטוס זה</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs uppercase tracking-wide font-semibold">
                    משלם
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide font-semibold">
                    סכום
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide font-semibold">
                    תוכנית
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide font-semibold">
                    אמצעי תשלום
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide font-semibold">
                    סטטוס
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide font-semibold">
                    תאריך
                  </TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.map((payment) => (
                  <TableRow key={payment.id} className="hover:bg-muted/50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="jarvis-gradient text-white text-xs">
                            {getInitials(payment.person_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{payment.person_name}</div>
                          {payment.person_email && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {payment.person_email}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold text-lg">
                        {formatCurrency(payment.amount, payment.currency)}
                      </span>
                    </TableCell>
                    <TableCell>{payment.program_name || "-"}</TableCell>
                    <TableCell>
                      {payment.payment_method
                        ? paymentMethodLabels[payment.payment_method] || payment.payment_method
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={statusVariants[payment.status] || statusVariants.pending}
                      >
                        {statusLabels[payment.status] || payment.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(payment.paid_at || payment.created_at)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => onSelectPerson?.(payment.person_id)}
                          >
                            <User className="w-4 h-4 ml-2" />
                            צפה במשלם
                          </DropdownMenuItem>
                          {payment.status === "pending" && (
                            <>
                              <DropdownMenuItem
                                onClick={() => setCompletingPayment(payment)}
                                className="text-green-600"
                              >
                                <CheckCircle className="w-4 h-4 ml-2" />
                                סמן כשולם
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setCancellingPayment(payment)}
                                className="text-destructive"
                              >
                                <XCircle className="w-4 h-4 ml-2" />
                                בטל תשלום
                              </DropdownMenuItem>
                            </>
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

      {/* Complete Payment Dialog */}
      <AlertDialog
        open={!!completingPayment}
        onOpenChange={() => setCompletingPayment(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>סמן תשלום כבוצע?</AlertDialogTitle>
            <AlertDialogDescription>
              האם לסמן את התשלום של {completingPayment?.person_name} בסך{" "}
              {completingPayment && formatCurrency(completingPayment.amount)} כבוצע?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>חזור</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCompletePayment}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              {completePayment.isPending ? "מעדכן..." : "סמן כשולם"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Payment Dialog */}
      <AlertDialog
        open={!!cancellingPayment}
        onOpenChange={() => setCancellingPayment(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>האם לבטל את התשלום?</AlertDialogTitle>
            <AlertDialogDescription>
              פעולה זו תבטל את התשלום של {cancellingPayment?.person_name}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>חזור</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelPayment}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelPayment.isPending ? "מבטל..." : "בטל תשלום"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default Payments;
