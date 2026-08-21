import { forwardRef, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import { Bell, Search, ShieldCheck, AlertTriangle, Clock, RefreshCw, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth, getTrialInfo } from "@/hooks/useAuth";
import { toast } from "sonner";

export const AdminLayout = forwardRef<HTMLDivElement, { children: React.ReactNode }>(
  ({ children }, ref) => {
    const { role, company, isTrialExpired, signOut } = useAuth();
    const [syncing, setSyncing] = useState(false);
    const trialInfo = getTrialInfo(company);

    const handleSync = async () => {
      setSyncing(true);
      const toastId = toast.loading("Syncing subscription status from cloud...");
      try {
        const res = await fetch("/api/cloud-sync/entitlements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Sync failed");
        }
        toast.success("Subscription synced successfully!", { id: toastId });
        window.location.reload();
      } catch (err: any) {
        toast.error(err.message || "Failed to sync subscription status", { id: toastId });
      } finally {
        setSyncing(false);
      }
    };

    return (
      <SidebarProvider>
        <div ref={ref} className="min-h-screen flex w-full">
          <AdminSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <header className="h-14 flex items-center justify-between border-b px-4 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <SidebarTrigger />
                <div className="relative hidden md:block">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search devices, content..."
                    className="w-64 pl-9 h-9 bg-muted/50 border-none"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Top-Bar License Expiration Indicator */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-medium select-none">
                  {company?.subscription_status === "active" && !trialInfo.isExpired ? (
                    <>
                      <ShieldCheck className="size-3.5 text-emerald-400 shrink-0" />
                      <span className="text-emerald-300 font-semibold">{trialInfo.text}</span>
                    </>
                  ) : trialInfo.isExpired ? (
                    <>
                      <AlertTriangle className="size-3.5 text-rose-400 shrink-0" />
                      <span className="text-rose-400 font-semibold">Access Expired</span>
                    </>
                  ) : (
                    <>
                      <Clock className="size-3.5 text-amber-400 shrink-0" />
                      <span className="text-amber-300 font-semibold">{trialInfo.text}</span>
                    </>
                  )}
                </div>

                {/* Manual Sync Refresh Button (Local Solo/Multi Modes only) */}
                {company?.local_mode && company.local_mode !== "none" && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleSync}
                    disabled={syncing}
                    className="size-8 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                    title="Sync subscription status from cloud"
                  >
                    <RefreshCw className={`size-3.5 ${syncing ? "animate-spin text-primary" : ""}`} />
                  </Button>
                )}

                <ThemeToggle />
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-4 w-4" />
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary animate-pulse-glow" />
                </Button>
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary">
                  A
                </div>
              </div>
            </header>
            <main className="flex-1 p-6 overflow-auto">
              {isTrialExpired && role !== "super_admin" ? (
                <div className="flex-1 min-h-[70vh] grid place-items-center p-6 select-none">
                  <div className="w-full max-w-md bg-card/60 backdrop-blur-xl rounded-3xl p-8 border border-rose-500/20 shadow-2xl text-center space-y-6">
                    <div className="size-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 grid place-items-center text-rose-400 mx-auto animate-bounce">
                      <AlertTriangle className="size-8" />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-xl font-bold text-rose-200">License / Trial Expired</h2>
                      <p className="text-xs text-rose-300/80 leading-relaxed">
                        Your license or free trial period has expired. Please contact your system administrator to unlock full access for your account.
                      </p>
                    </div>
                    <div className="space-y-3">
                      <Button
                        size="sm"
                        onClick={handleSync}
                        disabled={syncing}
                        className="w-full h-10 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white cursor-pointer shadow-lg shadow-rose-600/30"
                      >
                        <RefreshCw className={`size-3.5 mr-2 ${syncing ? "animate-spin" : ""}`} />
                        {syncing ? "Checking Cloud Status..." : "Sync Subscription Status"}
                      </Button>
                      <div className="text-xs font-semibold bg-rose-500/20 px-3 py-2 rounded-lg border border-rose-500/40 text-rose-200">
                        Contact Administrator to Renew Access
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          try {
                            await signOut();
                            window.location.href = "/login";
                          } catch (err) {
                            toast.error("Logout failed");
                          }
                        }}
                        className="w-full h-9 text-xs text-muted-foreground hover:text-rose-200 hover:bg-white/5 cursor-pointer mt-1"
                      >
                        <LogOut className="size-3.5 mr-2" />
                        Sign Out Account
                      </Button>
                    </div>
                    {trialInfo.trialEndsAt && (
                      <div className="border-t border-border/40 pt-4 text-[10px] text-muted-foreground">
                        Expired on: {new Date(trialInfo.trialEndsAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                children
              )}
            </main>
          </div>
        </div>
      </SidebarProvider>
    );
  }
);

AdminLayout.displayName = "AdminLayout";
