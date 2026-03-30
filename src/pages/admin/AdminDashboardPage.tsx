import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Monitor, Image, CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ devices: 0, content: 0, schedules: 0 });
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchStats = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      if (!profile?.company_id) { setLoading(false); return; }

      const companyId = profile.company_id;

      const [companyRes, devicesRes, contentRes, schedulesRes] = await Promise.all([
        supabase.from("companies").select("name").eq("id", companyId).single(),
        supabase.from("devices").select("id", { count: "exact", head: true }).eq("company_id", companyId),
        supabase.from("content").select("id", { count: "exact", head: true }).eq("company_id", companyId),
        supabase.from("schedules").select("id", { count: "exact", head: true }).eq("company_id", companyId),
      ]);

      setCompanyName(companyRes.data?.name ?? "");
      setStats({
        devices: devicesRes.count ?? 0,
        content: contentRes.count ?? 0,
        schedules: schedulesRes.count ?? 0,
      });
      setLoading(false);
    };

    fetchStats();
  }, [user]);

  const statCards = [
    { title: "Devices", value: stats.devices, icon: Monitor, color: "bg-primary/10", iconColor: "text-primary" },
    { title: "Content", value: stats.content, icon: Image, color: "bg-accent/50", iconColor: "text-accent-foreground" },
    { title: "Schedules", value: stats.schedules, icon: CalendarClock, color: "bg-primary/10", iconColor: "text-primary" },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {companyName ? `Welcome back, ${companyName}` : "Company overview"}
          </p>
        </div>

        <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
          {statCards.map((s) => (
            <Card key={s.title}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{s.title}</p>
                    <p className="text-3xl font-bold mt-1">{loading ? "—" : s.value}</p>
                  </div>
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${s.color}`}>
                    <s.icon className={`h-5 w-5 ${s.iconColor}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-3 flex-wrap">
            <a href="/admin/devices" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors">
              <Monitor className="h-4 w-4" /> Manage Devices
            </a>
            <a href="/admin/content" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors">
              <Image className="h-4 w-4" /> Upload Content
            </a>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
