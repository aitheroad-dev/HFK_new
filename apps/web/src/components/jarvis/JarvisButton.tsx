import { Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface JarvisButtonProps {
  onClick?: () => void;
  className?: string;
}

export function JarvisButton({ onClick, className }: JarvisButtonProps) {
  return (
    <Button
      onClick={onClick}
      className={cn(
        "jarvis-gradient text-white hover:opacity-90 gap-2",
        className
      )}
    >
      <Layers className="w-4 h-4" />
      שאל את נועם
    </Button>
  );
}

export default JarvisButton;
