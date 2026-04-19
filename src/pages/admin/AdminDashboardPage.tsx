import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Monitor, Image, CalendarClock, Layout, HardDrive, Wifi, WifiOff, CheckCircle2, Circle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { getStorageQuota, formatBytes } from "@/lib/plan-quotas";

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

type DeviceRow = {
  id: string;
  name: string;
  location: string | null;
  is_paired: boolean;
  last_seen_at: string | null;
};

const isOnline = (lastSeen: string | null) => {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < ONLINE_THRESHOLD_MS;
};

const formatBytes = (bytes: number) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

const STORAGE_QUOTA_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB default quota

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [companyName, setCompanyName] = useState("");
  const [maxScreens, setMaxScreens] = useState(0);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [contentCount, setContentCount] = useState(0);
  const [storageBytes, setStorageBytes] = useState(0);
  const [layoutCount, setLayoutCount] = useState(0);
  const [scheduleCount, setScheduleCount] = useState(0);
  const [activeSchedules, setActiveSchedules] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      if (!profile?.company_id) { setLoading(false); return; }
      const companyId = profile.company_id;

      const [companyRes, devicesRes, contentRes, layoutsRes, schedulesRes] = await Promise.all([
        supabase.from("companies").select("name, max_screens").eq("id", companyId).single(),
        supabase.from("devices").select("id, name, location, is_paired, last_seen_at").eq("company_id", companyId),
        supabase.from("content").select("id, file_size").eq("company_id", companyId),
        supabase.from("layouts").select("id", { count: "exact", head: true }).eq("company_id", companyId),
        supabase.from("schedules").select("id, is_active").eq("company_id", companyId),
      ]);

      setCompanyName(companyRes.data?.name ?? "");
      setMaxScreens(companyRes.data?.max_screens ?? 0);
      setDevices(devicesRes.data ?? []);
      setContentCount(contentRes.data?.length ?? 0);
      setStorageBytes((contentRes.data ?? []).reduce((sum, c: any) => sum + (c.file_size || 0), 0));
      setLayoutCount(layoutsRes.count ?? 0);
      setScheduleCount(schedulesRes.data?.length ?? 0);
      setActiveSchedules((schedulesRes.data ?? []).filter((s: any) => s.is_active).length);
      setLoading(false);
    };

    fetchData();
  }, [user]);

  const onlineDevices = devices.filter((d) => d.is_paired && isOnline(d.last_seen_at)).length;
  const totalDevices = devices.length;
  const storagePct = Math.min(100, (storageBytes / STORAGE_QUOTA_BYTES) * 100);
  const screenPct = maxScreens > 0 ? Math.min(100, (totalDevices / maxScreens) * 100) : 0;

  const checklist = [
    { label: "Pair your first device", done: devices.some((d) => d.is_paired), href: "/admin/devices" },
    { label: "Upload content", done: contentCount > 0, href: "/admin/content" },
    { label: "Create a layout", done: layoutCount > 0, href: "/admin/layouts" },
    { label: "Schedule content", done: scheduleCount > 0, href: "/admin/schedule" },
  ];
  const completedSteps = checklist.filter((c) => c.done).length;
  const showOnboarding = completedSteps < checklist.length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {companyName ? `Welcome back, ${companyName}` : "Company overview"}
          </p>
        </div>

        {showOnboarding && (
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Get started</CardTitle>
                <Badge variant="secondary">{completedSteps} of {checklist.length} complete</Badge>
              </div>
              <Progress value={(completedSteps / checklist.length) * 100} className="h-2 mt-2" />
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {checklist.map((step) => (
                <Link
                  key={step.label}
                  to={step.href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                    step.done ? "text-muted-foreground line-through" : "hover:bg-primary/10"
                  }`}
                >
                  {step.done ? (
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  {step.label}
                </Link>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Devices</p>
                <Monitor className="h-4 w-4 text-primary" />
              </div>
              <p className="text-3xl font-bold">{loading ? "—" : totalDevices}</p>
              <div className="flex items-center gap-3 mt-2 text-xs">
                <span className="flex items-center gap-1 text-emerald-600">
                  <Wifi className="h-3 w-3" /> {onlineDevices} online
                </span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <WifiOff className="h-3 w-3" /> {totalDevices - onlineDevices} offline
                </span>
              </div>
              {maxScreens > 0 && (
                <div className="mt-3">
                  <Progress value={screenPct} className="h-1.5" />
                  <p className="text-xs text-muted-foreground mt-1">{totalDevices} of {maxScreens} screens</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Content</p>
                <Image className="h-4 w-4 text-primary" />
              </div>
              <p className="text-3xl font-bold">{loading ? "—" : contentCount}</p>
              <div className="mt-3">
                <Progress value={storagePct} className="h-1.5" />
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <HardDrive className="h-3 w-3" /> {formatBytes(storageBytes)} used
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Layouts</p>
                <Layout className="h-4 w-4 text-primary" />
              </div>
              <p className="text-3xl font-bold">{loading ? "—" : layoutCount}</p>
              <p className="text-xs text-muted-foreground mt-2">Reusable templates</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Schedules</p>
                <CalendarClock className="h-4 w-4 text-primary" />
              </div>
              <p className="text-3xl font-bold">{loading ? "—" : scheduleCount}</p>
              <p className="text-xs text-muted-foreground mt-2">{activeSchedules} active</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Device Health</CardTitle>
            <Link to="/admin/devices" className="text-xs text-primary hover:underline">View all</Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : devices.length === 0 ? (
              <div className="text-center py-6">
                <Monitor className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No devices yet</p>
                <Link to="/admin/devices" className="text-xs text-primary hover:underline mt-1 inline-block">
                  Pair your first device →
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {devices.slice(0, 5).map((d) => {
                  const online = d.is_paired && isOnline(d.last_seen_at);
                  return (
                    <div key={d.id} className="flex items-center justify-between p-3 rounded-md border bg-card">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`h-2 w-2 rounded-full shrink-0 ${online ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/40"}`} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{d.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {d.location || "No location"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {!d.is_paired ? (
                          <Badge variant="outline" className="text-xs">
                            <AlertCircle className="h-3 w-3 mr-1" /> Unpaired
                          </Badge>
                        ) : online ? (
                          <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                            Online
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            {d.last_seen_at ? formatDistanceToNow(new Date(d.last_seen_at), { addSuffix: true }) : "Never seen"}
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
                {devices.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    +{devices.length - 5} more devices
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-3 flex-wrap">
            <Link to="/admin/devices" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors">
              <Monitor className="h-4 w-4" /> Manage Devices
            </Link>
            <Link to="/admin/content" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors">
              <Image className="h-4 w-4" /> Upload Content
            </Link>
            <Link to="/admin/layouts" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors">
              <Layout className="h-4 w-4" /> Layouts
            </Link>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
