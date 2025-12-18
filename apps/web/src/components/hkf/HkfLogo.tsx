import { cn } from "@/lib/utils";

interface HkfLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: "w-8 h-8",
  md: "w-10 h-10",
  lg: "w-12 h-12",
};

export function HkfLogo({ className, size = "md" }: HkfLogoProps) {
  return (
    <svg
      className={cn(sizeMap[size], "flex-shrink-0", className)}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="hkfGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: "#0acc83" }} />
          <stop offset="50%" style={{ stopColor: "#4b916d" }} />
          <stop offset="100%" style={{ stopColor: "#0040B6" }} />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="url(#hkfGradient)" />
      {/* K shape cutout */}
      <path
        d="M30 20 L30 80 L40 80 L40 55 L60 80 L75 80 L50 50 L75 20 L60 20 L40 45 L40 20 Z"
        fill="white"
      />
    </svg>
  );
}

export default HkfLogo;
