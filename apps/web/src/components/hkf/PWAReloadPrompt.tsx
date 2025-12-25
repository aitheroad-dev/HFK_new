import { useRegisterSW } from "virtual:pwa-register/react";
import { Button } from "@/components/ui/button";
import { RefreshCw, X } from "lucide-react";

export function PWAReloadPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log("SW Registered:", r);
    },
    onRegisterError(error) {
      console.log("SW registration error", error);
    },
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  if (!offlineReady && !needRefresh) return null;

  return (
    <div className="fixed bottom-20 md:bottom-4 inset-x-4 md:left-auto md:right-4 md:w-80 bg-card border rounded-lg shadow-lg p-4 z-50">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <RefreshCw className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          {offlineReady && (
            <>
              <h3 className="font-medium">מוכן לעבודה לא מקוונת</h3>
              <p className="text-sm text-muted-foreground mt-1">
                האפליקציה מוכנה לשימוש גם ללא חיבור לאינטרנט
              </p>
            </>
          )}
          {needRefresh && (
            <>
              <h3 className="font-medium">גרסה חדשה זמינה</h3>
              <p className="text-sm text-muted-foreground mt-1">
                לחץ על עדכן כדי לקבל את הגרסה האחרונה
              </p>
            </>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={close} className="flex-shrink-0">
          <X className="w-4 h-4" />
        </Button>
      </div>
      <div className="flex gap-2 mt-3">
        <Button variant="outline" className="flex-1 h-10" onClick={close}>
          סגור
        </Button>
        {needRefresh && (
          <Button className="flex-1 h-10" onClick={() => updateServiceWorker(true)}>
            עדכן
          </Button>
        )}
      </div>
    </div>
  );
}
