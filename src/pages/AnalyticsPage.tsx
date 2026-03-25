import { DashboardLayout } from "@/components/DashboardLayout";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Eye, Clock, AlertTriangle, TrendingUp } from "lucide-react";

const playData = [
  { name: 'Welcome Banner', plays: 2847, hours: 42 },
  { name: 'Product Demo', plays: 1923, hours: 80 },
  { name: 'Holiday Promo', plays: 1456, hours: 18 },
  { name: 'Menu Board', plays: 3241, hours: 96 },
  { name: 'Breaking News', plays: 892, hours: 12 },
];

const uptimeData = [
  { name: 'Lobby Display', uptime: 99.8, downtime: '0.5 hrs' },
  { name: 'Cafeteria Screen', uptime: 98.5, downtime: '3.6 hrs' },
  { name: 'Conference Room A', uptime: 87.2, downtime: '30.7 hrs' },
  { name: 'Retail Window', uptime: 99.1, downtime: '2.2 hrs' },
  { name: 'Elevator Display', uptime: 95.3, downtime: '11.3 hrs' },
  { name: 'Reception TV', uptime: 99.9, downtime: '0.2 hrs' },
];

export default function AnalyticsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Performance metrics and reports</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total Plays" value="10,359" change="+12.5% vs last week" changeType="positive" icon={Eye} />
          <StatCard title="Avg Uptime" value="96.6%" change="+0.3% vs last month" changeType="positive" icon={Clock} iconColor="bg-success/15" />
          <StatCard title="Errors" value="3" change="-2 vs last week" changeType="positive" icon={AlertTriangle} iconColor="bg-warning/15" />
          <StatCard title="Content Reach" value="48.2K" change="Impressions this week" changeType="neutral" icon={TrendingUp} iconColor="bg-info/15" />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Content Play Counts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {playData.map((item) => (
                <div key={item.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium">{item.name}</span>
                    <span className="text-sm text-muted-foreground">{item.plays.toLocaleString()} plays</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${(item.plays / 3241) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Device Uptime</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {uptimeData.map((item) => (
                <div key={item.name} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                  <div>
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">Downtime: {item.downtime}</p>
                  </div>
                  <span className={`text-sm font-semibold ${item.uptime >= 99 ? 'text-success' : item.uptime >= 95 ? 'text-warning' : 'text-destructive'}`}>
                    {item.uptime}%
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
