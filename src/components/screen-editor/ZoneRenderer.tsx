import { useState, useRef, type DragEvent } from "react";
import { cn } from "@/lib/utils";
import {
  ScreenZone,
  ContentWidget,
  ContentWidgetType,
  TextAnimation,
  splitZone,
  createWidget,
} from "@/lib/screen-editor-types";
import {
  SplitSquareHorizontal,
  SplitSquareVertical,
  Trash2,
  GripVertical,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ZoneRendererProps {
  zone: ScreenZone;
  onUpdate: (zone: ScreenZone) => void;
  onSelectZone: (zoneId: string) => void;
  selectedZoneId: string | null;
  depth?: number;
}

function WidgetPreview({ widget }: { widget: ContentWidget }) {
  const animationClass = (() => {
    switch (widget.textAnimation) {
      case 'scroll-left':
        return widget.scrollSpeed === 'slow' ? 'animate-marquee-slow' : widget.scrollSpeed === 'fast' ? 'animate-marquee-fast' : 'animate-marquee';
      case 'scroll-up':
        return 'animate-marquee-vertical';
      case 'typewriter':
        return 'animate-typewriter overflow-hidden whitespace-nowrap';
      case 'fade':
        return 'animate-pulse-glow';
      case 'blink':
        return 'animate-blink';
      default:
        return '';
    }
  })();

  const style: React.CSSProperties = {
    backgroundColor: widget.backgroundColor || 'transparent',
    padding: widget.padding,
    borderRadius: widget.borderRadius,
    opacity: (widget.opacity ?? 100) / 100,
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  };

  if (widget.type === 'text' || widget.type === 'rss') {
    return (
      <div style={style}>
        <div className={cn("whitespace-nowrap", animationClass)} style={{
          fontSize: widget.fontSize,
          fontWeight: widget.fontWeight || '400',
          color: widget.textColor || '#ffffff',
        }}>
          {widget.text || 'Text'}
        </div>
      </div>
    );
  }

  if (widget.type === 'clock') {
    return (
      <div style={style}>
        <ClockWidget fontSize={widget.fontSize} color={widget.textColor} fontWeight={widget.fontWeight} />
      </div>
    );
  }

  if (widget.type === 'weather') {
    return (
      <div style={style}>
        <div className="text-center" style={{ color: widget.textColor || '#ffffff' }}>
          <div className="text-3xl mb-1">☀️</div>
          <div className="text-lg font-semibold">22°C</div>
          <div className="text-xs opacity-70">Sunny</div>
        </div>
      </div>
    );
  }

  if (widget.type === 'image') {
    return (
      <div style={style} className="relative">
        {widget.mediaUrl ? (
          <img src={widget.mediaUrl} alt="" className="w-full h-full" style={{ objectFit: widget.objectFit || 'cover' }} />
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <div className="text-2xl">🖼️</div>
            <span className="text-xs">{widget.mediaName || 'No image'}</span>
          </div>
        )}
      </div>
    );
  }

  if (widget.type === 'video') {
    return (
      <div style={style}>
        <div className="flex flex-col items-center gap-1 text-muted-foreground">
          <div className="text-2xl">🎬</div>
          <span className="text-xs">{widget.mediaName || 'No video'}</span>
        </div>
      </div>
    );
  }

  return (
    <div style={style} className="flex items-center justify-center text-muted-foreground text-xs">
      Empty
    </div>
  );
}

function ClockWidget({ fontSize, color, fontWeight }: { fontSize?: number; color?: string; fontWeight?: string }) {
  const [time, setTime] = useState(new Date().toLocaleTimeString());
  useState(() => {
    const interval = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(interval);
  });
  return (
    <span style={{ fontSize: fontSize || 48, color: color || '#ffffff', fontWeight: fontWeight || '700' }}>
      {time}
    </span>
  );
}

export function ZoneRenderer({ zone, onUpdate, onSelectZone, selectedZoneId, depth = 0 }: ZoneRendererProps) {
  const isSelected = zone.id === selectedZoneId;
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const widgetType = e.dataTransfer.getData('widget-type') as ContentWidgetType;
    if (widgetType && zone.split === 'none') {
      const widget = createWidget(widgetType);
      onUpdate({ ...zone, content: widget });
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (zone.split === 'none') setIsDragOver(true);
  };

  const handleSplit = (direction: 'horizontal' | 'vertical') => {
    onUpdate(splitZone(zone, direction));
  };

  const handleDelete = () => {
    onUpdate({ ...zone, content: null, split: 'none', children: null });
  };

  if (zone.split !== 'none' && zone.children) {
    const isH = zone.split === 'horizontal';
    return (
      <div className={cn("flex w-full h-full", isH ? "flex-row" : "flex-col")} style={{ gap: 2 }}>
        <div style={{ [isH ? 'width' : 'height']: `${zone.splitRatio}%`, [isH ? 'height' : 'width']: '100%' }}>
          <ZoneRenderer
            zone={zone.children[0]}
            onUpdate={(updated) => {
              const newChildren: [ScreenZone, ScreenZone] = [updated, zone.children![1]];
              onUpdate({ ...zone, children: newChildren });
            }}
            onSelectZone={onSelectZone}
            selectedZoneId={selectedZoneId}
            depth={depth + 1}
          />
        </div>
        {/* Resize handle */}
        <div
          className={cn(
            "shrink-0 flex items-center justify-center cursor-col-resize bg-border/60 hover:bg-primary/40 transition-colors z-10",
            isH ? "w-1.5 h-full" : "h-1.5 w-full cursor-row-resize"
          )}
          onMouseDown={(e) => {
            e.preventDefault();
            const parent = (e.target as HTMLElement).parentElement!;
            const rect = parent.getBoundingClientRect();
            const handleMove = (me: MouseEvent) => {
              const ratio = isH
                ? ((me.clientX - rect.left) / rect.width) * 100
                : ((me.clientY - rect.top) / rect.height) * 100;
              onUpdate({ ...zone, splitRatio: Math.max(10, Math.min(90, ratio)) });
            };
            const handleUp = () => {
              window.removeEventListener('mousemove', handleMove);
              window.removeEventListener('mouseup', handleUp);
            };
            window.addEventListener('mousemove', handleMove);
            window.addEventListener('mouseup', handleUp);
          }}
        >
          <GripVertical className={cn("h-3 w-3 text-muted-foreground", !isH && "rotate-90")} />
        </div>
        <div style={{ [isH ? 'width' : 'height']: `${100 - zone.splitRatio}%`, [isH ? 'height' : 'width']: '100%' }}>
          <ZoneRenderer
            zone={zone.children[1]}
            onUpdate={(updated) => {
              const newChildren: [ScreenZone, ScreenZone] = [zone.children![0], updated];
              onUpdate({ ...zone, children: newChildren });
            }}
            onSelectZone={onSelectZone}
            selectedZoneId={selectedZoneId}
            depth={depth + 1}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative w-full h-full transition-all duration-150 group/zone",
        isDragOver && "ring-2 ring-primary ring-inset",
        isSelected && "ring-2 ring-primary ring-inset",
        !zone.content && "border border-dashed border-border/60"
      )}
      onClick={(e) => {
        e.stopPropagation();
        onSelectZone(zone.id);
      }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={() => setIsDragOver(false)}
    >
      {zone.content ? (
        <WidgetPreview widget={zone.content} />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground/50">
          <p className="text-xs">Drop content here</p>
        </div>
      )}

      {/* Zone toolbar */}
      <div className={cn(
        "absolute top-1 right-1 flex gap-1 opacity-0 transition-opacity z-20",
        (isSelected || isDragOver) && "opacity-100",
        "group-hover/zone:opacity-100"
      )}>
        <Button
          variant="secondary"
          size="icon"
          className="h-6 w-6 bg-card/90 backdrop-blur-sm hover:bg-card"
          onClick={(e) => { e.stopPropagation(); handleSplit('horizontal'); }}
          title="Split Horizontally"
        >
          <SplitSquareHorizontal className="h-3 w-3" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="h-6 w-6 bg-card/90 backdrop-blur-sm hover:bg-card"
          onClick={(e) => { e.stopPropagation(); handleSplit('vertical'); }}
          title="Split Vertically"
        >
          <SplitSquareVertical className="h-3 w-3" />
        </Button>
        {zone.content && (
          <Button
            variant="secondary"
            size="icon"
            className="h-6 w-6 bg-card/90 backdrop-blur-sm hover:bg-destructive/90 hover:text-destructive-foreground"
            onClick={(e) => { e.stopPropagation(); handleDelete(); }}
            title="Clear"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
