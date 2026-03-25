import { DashboardLayout } from "@/components/DashboardLayout";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { mockDevices, mockPlaylists } from "@/lib/mock-data";
import { Monitor, Wifi, WifiOff, FolderOpen, ListVideo, TrendingUp, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  const onlineCount = mockDevices.filter(d => d.status === 'online').length;
  const offlineCount = mockDevices.filter(d => d.status === 'offline').length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Overview of your digital signage network</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Screens"
            value={mockDevices.length}
            change="+2 this month"
            changeType="positive"
            icon={Monitor}
          />
          <StatCard
            title="Online"
            value={onlineCount}
            change={`${Math.round((onlineCount / mockDevices.length) * 100)}% uptime`}
            changeType="positive"
            icon={Wifi}
            iconColor="bg-success/15"
          />
          <StatCard
            title="Content Items"
            value={42}
            change="+8 this week"
            changeType="positive"
            icon={FolderOpen}
            iconColor="bg-info/15"
          />
          <StatCard
            title="Active Playlists"
            value={mockPlaylists.filter(p => p.status === 'active').length}
            icon={ListVideo}
            iconColor="bg-warning/15"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Device Status */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Device Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mockDevices.map((device) => (
                  <div key={device.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <Monitor className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{device.name}</p>
                        <p className="text-xs text-muted-foreground">{device.location}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-muted-foreground hidden sm:block">{device.lastSeen}</span>
                      <StatusBadge status={device.status} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Network Health</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wifi className="h-4 w-4 text-success" />
                    <span className="text-sm">Online</span>
                  </div>
                  <span className="text-sm font-semibold">{onlineCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <WifiOff className="h-4 w-4 text-destructive" />
                    <span className="text-sm">Offline</span>
                  </div>
                  <span className="text-sm font-semibold">{offlineCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-warning" />
                    <span className="text-sm">Idle</span>
                  </div>
                  <span className="text-sm font-semibold">{mockDevices.filter(d => d.status === 'idle').length}</span>
                </div>
                <div className="pt-3 border-t">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      <span className="text-sm">Avg Uptime</span>
                    </div>
                    <span className="text-sm font-semibold text-primary">
                      {(mockDevices.reduce((a, d) => a + d.uptime, 0) / mockDevices.length).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Recent Playlists</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {mockPlaylists.slice(0, 4).map((pl) => (
                  <div key={pl.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{pl.name}</p>
                      <p className="text-xs text-muted-foreground">{pl.itemCount} items · {pl.duration}</p>
                    </div>
                    <StatusBadge status={pl.status} />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
