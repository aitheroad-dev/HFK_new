import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false
  );

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed top-0 inset-x-0 bg-yellow-500 text-yellow-950 py-2 px-4 text-center text-sm z-50 safe-area-top">
      <WifiOff className="w-4 h-4 inline-block ml-2" />
      אתה במצב לא מקוון. חלק מהנתונים עשויים להיות לא מעודכנים.
    </div>
  );
}
