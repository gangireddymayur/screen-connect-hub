import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatCard } from "@/components/StatCard";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Users, Monitor } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  const [stats, setStats] = useState({ companies: 0, users: 0, totalScreens: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      const [companiesRes, usersRes] = await Promise.all([
        supabase.from("companies").select("*"),
        supabase.from("profiles").select("*"),
      ]);

      const companies = companiesRes.data ?? [];
      const totalScreens = companies.reduce((sum, c) => sum + (c.max_screens || 0), 0);

      setStats({
        companies: companies.length,
        users: (usersRes.data ?? []).length,
        totalScreens,
      });
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

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Total Companies"
            value={stats.companies}
            icon={Building2}
            change="all time"
          />
          <StatCard
            title="Total Users"
            value={stats.users}
            icon={Users}
            change="all time"
          />
          <StatCard
            title="Screen Capacity"
            value={stats.totalScreens}
            icon={Monitor}
            change="across companies"
          />
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
