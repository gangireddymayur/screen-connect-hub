import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatCard } from "@/components/StatCard";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Users, Monitor, UserCheck, UserX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  const [stats, setStats] = useState({ companies: 0, users: 0, totalScreens: 0, activeCompanies: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const [companiesRes, usersRes] = await Promise.all([
        supabase.from("companies").select("id, max_screens, status"),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
      ]);

      const companies = companiesRes.data ?? [];
      const totalScreens = companies.reduce((sum, c) => sum + (c.max_screens || 0), 0);
      const activeCompanies = companies.filter(c => c.status === "active").length;

      setStats({
        companies: companies.length,
        users: usersRes.count ?? 0,
        totalScreens,
        activeCompanies,
      });
      setLoading(false);
    };
    fetchStats();
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Super Admin overview</p>
        </div>

        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatCard title="Companies" value={loading ? "—" : stats.companies} icon={Building2} change={`${stats.activeCompanies} active`} changeType="positive" />
          <StatCard title="Users" value={loading ? "—" : stats.users} icon={Users} change="all admins" />
          <StatCard title="Screen Capacity" value={loading ? "—" : stats.totalScreens} icon={Monitor} change="across companies" />
          <StatCard title="Active Companies" value={loading ? "—" : stats.activeCompanies} icon={UserCheck} change={stats.companies > 0 ? `${Math.round((stats.activeCompanies / stats.companies) * 100)}%` : "0%"} changeType="positive" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-3 flex-wrap">
            <a href="/companies" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors">
              <Building2 className="h-4 w-4" /> Manage Companies
            </a>
            <a href="/users" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors">
              <Users className="h-4 w-4" /> Manage Users
            </a>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
