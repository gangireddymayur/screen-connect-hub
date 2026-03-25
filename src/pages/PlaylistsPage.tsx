import { DashboardLayout } from "@/components/DashboardLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { mockPlaylists } from "@/lib/mock-data";
import { Plus, ListVideo, Monitor, Clock, MoreVertical } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PlaylistsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Playlists</h1>
            <p className="text-sm text-muted-foreground mt-1">Create and manage content playlists</p>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Playlist
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mockPlaylists.map((pl) => (
            <Card key={pl.id} className="group hover:shadow-md transition-all cursor-pointer hover:border-primary/20">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <ListVideo className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={pl.status} />
                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <h3 className="font-semibold text-sm">{pl.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">Modified {pl.lastModified}</p>
                <div className="flex items-center gap-4 mt-4 pt-4 border-t">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ListVideo className="h-3.5 w-3.5" />
                    <span>{pl.itemCount} items</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{pl.duration}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Monitor className="h-3.5 w-3.5" />
                    <span>{pl.assignedScreens} screens</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
