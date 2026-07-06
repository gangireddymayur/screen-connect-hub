import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatCard } from "@/components/StatCard";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Users, Monitor, UserCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export default function DashboardPage() {
  const [stats, setStats] = useState({ companies: 0, users: 0, totalScreens: 0, activeCompanies: 0 });
  const [loading, setLoading] = useState(true);

  // Offline Generation Modal states
  const [open, setOpen] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [generating, setGenerating] = useState(false);

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

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const token = localStorage.getItem("sh_token");
      const response = await fetch("/api/functions/generate-offline", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          company_name: companyName,
          email,
          password
        })
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error || "Failed to generate package");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `signage-hub-offline-${companyName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      setOpen(false);
      setCompanyName("");
      setEmail("");
      setPassword("");
    } catch (err: any) {
      alert(err.message || "An error occurred");
    } finally {
      setGenerating(false);
    }
  };

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
          <CardContent className="flex gap-3 flex-wrap items-center">
            <a href="/companies" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors h-9">
              <Building2 className="h-4 w-4" /> Manage Companies
            </a>
            <a href="/users" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors h-9">
              <Users className="h-4 w-4" /> Manage Users
            </a>

            {/* Offline Bundle Download Modal */}
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors border-none h-9">
                  <Building2 className="h-4 w-4" /> Download Offline Windows Server
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Configure Offline Windows Server Bundle</DialogTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Specify the local administrator account credentials. This will pre-seed the offline SQLite database file.
                  </p>
                </DialogHeader>
                
                <div className="space-y-4 pt-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="off-cname" className="text-xs font-semibold text-muted-foreground">Client Company Name</Label>
                    <Input 
                      id="off-cname" 
                      placeholder="e.g. Acme Retail Local" 
                      value={companyName}
                      onChange={e => setCompanyName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="off-email" className="text-xs font-semibold text-muted-foreground">Local Admin Email</Label>
                    <Input 
                      id="off-email" 
                      type="email"
                      placeholder="admin@acme-local.com" 
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="off-pass" className="text-xs font-semibold text-muted-foreground">Local Admin Password</Label>
                    <Input 
                      id="off-pass" 
                      type="password"
                      placeholder="••••••••" 
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-border/50 mt-4">
                  <Button variant="outline" onClick={() => setOpen(false)} disabled={generating}>Cancel</Button>
                  <Button onClick={handleGenerate} disabled={generating || !companyName || !email || !password}>
                    {generating ? "Generating Bundle..." : "Generate & Download"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
