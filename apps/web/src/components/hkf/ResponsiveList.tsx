import { ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

interface ResponsiveListProps<T> {
  items: T[];
  renderCard: (item: T, index: number) => ReactNode;
  renderTable: () => ReactNode;
  emptyMessage?: string;
  loadingMessage?: string;
  isLoading?: boolean;
}

export function ResponsiveList<T>({
  items,
  renderCard,
  renderTable,
  emptyMessage = "לא נמצאו פריטים",
  loadingMessage = "טוען...",
  isLoading = false,
}: ResponsiveListProps<T>) {
  const isMobile = useIsMobile();

  if (isLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        {loadingMessage}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="space-y-3">
        {items.map((item, index) => renderCard(item, index))}
      </div>
    );
  }

  return renderTable();
}
