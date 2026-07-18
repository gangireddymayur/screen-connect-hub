import {
  LayoutDashboard,
  Building2,
  Users,
  Settings,
  Tv,
  LogOut,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const superAdminNav = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Companies", url: "/companies", icon: Building2 },
  { title: "Users", url: "/users", icon: Users },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { user, signOut } = useAuth();

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary">
            <Tv className="h-5 w-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-bold text-sidebar-accent-foreground tracking-tight">
                SignageHub
              </span>
              <span className="text-[10px] text-sidebar-foreground/50 uppercase tracking-widest">
                Super Admin
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-sidebar-foreground/40">
            Management
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {superAdminNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} end={item.url === "/"}>
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 space-y-2">
        {!collapsed && (
          <div className="rounded-lg bg-sidebar-accent p-3">
            <p className="text-xs font-medium text-sidebar-accent-foreground">Super Admin</p>
            <p className="text-[10px] text-sidebar-foreground/50 truncate">{user?.email}</p>
          </div>
        )}
        {!collapsed && (
          <Button
            variant="default"
            size="sm"
            className="w-full justify-start gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={async () => {
              try {
                const token = localStorage.getItem("auth_token");
                const headers = {};
                if (token) headers["Authorization"] = `Bearer ${token}`;
                
                const apiRoot = (import.meta as any).env?.VITE_API_URL || "";
                const response = await fetch(`${apiRoot}/api/functions/download-tv-apk`, {
                  method: "POST",
                  headers
                });
                
                if (!response.ok) {
                  const errorJson = await response.json().catch(() => ({}));
                  throw new Error(errorJson.error || "Failed to download TV APK file");
                }
                
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "SignageHub-TV.apk";
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
              } catch (err: any) {
                console.error("TV APK download error:", err);
                alert(err.message || "Failed to download Android TV App APK. Please make sure the app is built.");
              }
            }}
          >
            <Tv className="h-4 w-4 shrink-0" />
            <span>Download TV App APK</span>
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={() => signOut()}
        >
          <LogOut className="h-4 w-4 mr-2" />
          {!collapsed && <span>Logout</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
