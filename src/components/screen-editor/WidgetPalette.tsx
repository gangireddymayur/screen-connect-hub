import { type DragEvent } from "react";
import {
  Type,
  Image,
  Video,
  Clock,
  CloudSun,
  Rss,
  Images,
} from "lucide-react";
import { ContentWidgetType } from "@/lib/screen-editor-types";

const widgets: { type: ContentWidgetType; label: string; icon: React.ElementType; color: string }[] = [
  { type: 'text', label: 'Text', icon: Type, color: 'bg-warning/15 text-warning' },
  { type: 'image', label: 'Image', icon: Image, color: 'bg-info/15 text-info' },
  { type: 'slideshow', label: 'Slideshow', icon: Images, color: 'bg-success/15 text-success' },
  { type: 'video', label: 'Video', icon: Video, color: 'bg-primary/15 text-primary' },
  { type: 'clock', label: 'Clock', icon: Clock, color: 'bg-success/15 text-success' },
  { type: 'weather', label: 'Weather', icon: CloudSun, color: 'bg-warning/15 text-warning' },
  { type: 'rss', label: 'RSS Ticker', icon: Rss, color: 'bg-destructive/15 text-destructive' },
];

export function WidgetPalette() {
  const handleDragStart = (e: DragEvent, type: ContentWidgetType) => {
    e.dataTransfer.setData('widget-type', type);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Widgets
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {widgets.map((w) => (
          <div
            key={w.type}
            draggable
            onDragStart={(e) => handleDragStart(e, w.type)}
            className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-border bg-card hover:bg-muted/50 cursor-grab active:cursor-grabbing transition-all hover:shadow-sm hover:border-primary/30 select-none"
          >
            <div className={`h-8 w-8 rounded-md flex items-center justify-center ${w.color}`}>
              <w.icon className="h-4 w-4" />
            </div>
            <span className="text-xs font-medium">{w.label}</span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground text-center mt-2">
        Drag widgets onto the screen canvas
      </p>
    </div>
  );
}
