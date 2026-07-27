import { forwardRef, useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import { Bell, Search, AlertTriangle, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { useLocation, useNavigate } from "react-router-dom";

export const AdminLayout = forwardRef<HTMLDivElement, { children: React.ReactNode }>(
  ({ children }, ref) => {
    const { role, isTrialExpired } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
      console.log("[AdminLayout] useEffect - isTrialExpired:", isTrialExpired, "role:", role, "pathname:", location.pathname);
      if (isTrialExpired && role !== "super_admin" && location.pathname !== "/admin/settings") {
        navigate("/admin/settings", { replace: true });
      }
    }, [isTrialExpired, role, location.pathname, navigate]);

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
              {isTrialExpired && role !== "super_admin" && (
                <div className="bg-destructive/15 border border-destructive/30 rounded-xl p-4 text-destructive flex items-center justify-between gap-4 mb-6 select-none">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-lg bg-destructive/20 grid place-items-center text-destructive shrink-0 font-bold">
                      <ShieldAlert className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm flex items-center gap-2">
                        <span>7-Day Free Trial Expired</span>
                        <span className="text-[10px] bg-destructive/30 text-destructive-foreground px-2 py-0.5 rounded-full font-bold">Limit Reached</span>
                      </div>
                      <div className="text-xs opacity-90 mt-0.5">
                        Your 7-day free trial period has ended. Please contact your system administrator to grant full access for your account.
                      </div>
                    </div>
                  </div>
                  <div className="text-xs font-semibold bg-destructive/20 px-3 py-1.5 rounded-lg border border-destructive/40 shrink-0">
                    Contact Admin to Unlock
                  </div>
                </div>
              )}
              {children}
            </main>
          </div>
        </div>
      </SidebarProvider>
    );
  }
);

AdminLayout.displayName = "AdminLayout";
