import { DashboardLayout } from "@/components/DashboardLayout";
import { mockContent } from "@/lib/mock-data";
import { Upload, Image, Video, Type, MoreVertical, Grid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { cn } from "@/lib/utils";

export default function ContentPage() {
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const filtered = mockContent.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const typeIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image className="h-5 w-5" />;
      case 'video': return <Video className="h-5 w-5" />;
      case 'text': return <Type className="h-5 w-5" />;
      default: return null;
    }
  };

  const typeColor = (type: string) => {
    switch (type) {
      case 'image': return 'bg-info/15 text-info';
      case 'video': return 'bg-primary/15 text-primary';
      case 'text': return 'bg-warning/15 text-warning';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Content Library</h1>
            <p className="text-sm text-muted-foreground mt-1">Upload and manage your media</p>
          </div>
          <Button>
            <Upload className="h-4 w-4 mr-2" />
            Upload Media
          </Button>
        </div>

        <div className="flex items-center justify-between gap-3">
          <Input
            placeholder="Search content..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            <Button variant={view === 'grid' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setView('grid')}>
              <Grid className="h-4 w-4" />
            </Button>
            <Button variant={view === 'list' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setView('list')}>
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Upload Drop Zone */}
        <div className="border-2 border-dashed rounded-xl p-8 text-center border-border hover:border-primary/50 transition-colors cursor-pointer">
          <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm font-medium">Drop files here or click to upload</p>
          <p className="text-xs text-muted-foreground mt-1">Supports images, videos, and text files</p>
        </div>

        {view === 'grid' ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((item) => (
              <div key={item.id} className="group stat-card cursor-pointer">
                <div className="aspect-video rounded-lg bg-muted/80 mb-3 flex items-center justify-center">
                  <div className={cn("h-12 w-12 rounded-full flex items-center justify-center", typeColor(item.type))}>
                    {typeIcon(item.type)}
                  </div>
                </div>
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.size} {item.duration && `· ${item.duration}`} · Used in {item.usedIn} playlists
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-card border hover:bg-muted/50 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", typeColor(item.type))}>
                    {typeIcon(item.type)}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.type} · {item.size} {item.duration && `· ${item.duration}`}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{item.uploadedAt}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
