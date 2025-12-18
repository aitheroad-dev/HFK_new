import { Layers } from "lucide-react";
import { cn } from "@/lib/utils";

interface AiActionButtonProps {
  label: string;
  onClick?: () => void;
  className?: string;
}

export function AiActionButton({ label, onClick, className }: AiActionButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-sm text-xs font-medium",
        "jarvis-gradient-subtle border border-primary/20 text-primary",
        "hover:bg-primary/15 hover:border-primary transition-colors cursor-pointer",
        className
      )}
    >
      <Layers className="w-3 h-3" />
      {label}
    </button>
  );
}

export default AiActionButton;
