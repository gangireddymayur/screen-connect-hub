import { useState, useEffect, useCallback, useRef, type DragEvent } from "react";
import { cn } from "@/lib/utils";
import {
  ScreenZone,
  ContentWidget,
  ContentWidgetType,
  SlideshowItem,
  SlideTransition,
  LinkPlatform,
  PlaylistItem,
  splitZone,
  createWidget,
} from "@/lib/screen-editor-types";
import {
  SplitSquareHorizontal,
  SplitSquareVertical,
  Trash2,
  GripVertical,
  Instagram,
  Youtube,
  Facebook,
  Twitter,
  Linkedin,
  Github,
  Globe,
  Music2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const platformMeta: Record<LinkPlatform, { icon: React.ElementType; color: string; label: string }> = {
  instagram: { icon: Instagram, color: '#E1306C', label: 'Instagram' },
  youtube:   { icon: Youtube,   color: '#FF0000', label: 'YouTube' },
  facebook:  { icon: Facebook,  color: '#1877F2', label: 'Facebook' },
  twitter:   { icon: Twitter,   color: '#1DA1F2', label: 'Twitter / X' },
  tiktok:    { icon: Music2,    color: '#000000', label: 'TikTok' },
  linkedin:  { icon: Linkedin,  color: '#0A66C2', label: 'LinkedIn' },
  github:    { icon: Github,    color: '#24292e', label: 'GitHub' },
  website:   { icon: Globe,     color: '#0ea5e9', label: 'Website' },
};

function LinksWidget({ widget, interactive }: { widget: ContentWidget; interactive: boolean }) {
  // Show all links in the editor (even empty ones) so the user sees the slots.
  // In live preview, only show ones that have a URL.
  const links = interactive
    ? (widget.links || []).filter(l => l.url)
    : (widget.links || []);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [autoHorizontal, setAutoHorizontal] = useState(true);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setAutoHorizontal(width >= height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const setting = widget.linksOrientation || 'auto';
  const isHorizontal = setting === 'auto' ? autoHorizontal : setting === 'horizontal';

  const style: React.CSSProperties = {
    backgroundColor: widget.backgroundColor || 'transparent',
    padding: widget.padding,
    borderRadius: widget.borderRadius,
    opacity: (widget.opacity ?? 100) / 100,
    pointerEvents: interactive ? 'none' : 'auto',
  };

  return (
    <div
      ref={containerRef}
      className={cn("w-full h-full flex overflow-hidden", isHorizontal ? "flex-row" : "flex-col")}
      style={style}
    >
      {links.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs">
          No links configured
        </div>
      ) : links.map((link) => {
        const meta = platformMeta[link.platform];
        const Icon = meta.icon;
        const bg = link.iconColor || meta.color;
        const handleClick = (e: React.MouseEvent) => {
          if (!interactive || !link.url) return;
          e.stopPropagation();
          window.open(link.url, '_blank', 'noopener,noreferrer');
        };
        return (
          <button
            key={link.id}
            onClick={handleClick}
            title={link.url || meta.label}
            className={cn(
              "min-w-0 min-h-0 flex flex-1 basis-0 items-center justify-center gap-1.5 px-2 transition-colors",
              isHorizontal ? "border-r border-background/20 last:border-r-0" : "border-b border-background/20 last:border-b-0",
              interactive && link.url ? "cursor-pointer hover:scale-[1.03]" : "cursor-default",
              !link.url && "opacity-70",
            )}
            style={{ backgroundColor: bg, color: '#fff', pointerEvents: interactive && link.url ? 'auto' : 'none' }}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="text-[11px] font-semibold truncate">{link.label || meta.label}</span>
          </button>
        );
      })}
    </div>
  );
}


interface ZoneRendererProps {
  zone: ScreenZone;
  onUpdate: (zone: ScreenZone) => void;
  onSelectZone: (zoneId: string) => void;
  selectedZoneId: string | null;
  depth?: number;
  previewMode?: boolean;
}

/* ── Transition CSS for slideshow ── */
function getTransitionStyle(transition: SlideTransition, isActive: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    transition: 'all 0.8s ease-in-out',
  };

  if (isActive) {
    return { ...base, opacity: 1, transform: 'translate(0,0) scale(1) rotateY(0deg)' };
  }

  switch (transition) {
    case 'fade':
      return { ...base, opacity: 0 };
    case 'slide-left':
      return { ...base, opacity: 0, transform: 'translateX(-100%)' };
    case 'slide-right':
      return { ...base, opacity: 0, transform: 'translateX(100%)' };
    case 'slide-up':
      return { ...base, opacity: 0, transform: 'translateY(-100%)' };
    case 'slide-down':
      return { ...base, opacity: 0, transform: 'translateY(100%)' };
    case 'zoom-in':
      return { ...base, opacity: 0, transform: 'scale(0.3)' };
    case 'zoom-out':
      return { ...base, opacity: 0, transform: 'scale(1.5)' };
    case 'flip':
      return { ...base, opacity: 0, transform: 'rotateY(90deg)' };
    case 'none':
      return { ...base, opacity: 0 };
    default:
      return { ...base, opacity: 0 };
  }
}

/* ── Slideshow Player ── */
function SlideshowPreview({ widget }: { widget: ContentWidget }) {
  const slides = widget.slides || [];
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const currentSlide = slides[currentIndex];
    const duration = (currentSlide?.duration || 5) * 1000;
    const timer = setTimeout(() => {
      setCurrentIndex((prev) => {
        const next = prev + 1;
        if (next >= slides.length) {
          return widget.slideshowLoop ? 0 : prev;
        }
        return next;
      });
    }, duration);
    return () => clearTimeout(timer);
  }, [currentIndex, slides, widget.slideshowLoop]);

  if (slides.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <div className="text-2xl mb-1">🖼️</div>
          <span className="text-xs">No slides added</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ perspective: '1000px' }}>
      {slides.map((slide, index) => {
        const isActive = index === currentIndex;
        return (
          <div key={slide.id} style={getTransitionStyle(slide.transition, isActive)}>
            {slide.imageUrl ? (
              <img
                src={slide.imageUrl}
                alt={slide.imageName}
                className="w-full h-full"
                style={{ objectFit: slide.objectFit || 'cover' }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-muted/20">
                <div className="text-center text-muted-foreground">
                  <div className="text-lg">🖼️</div>
                  <span className="text-[10px]">{slide.imageName || `Slide ${index + 1}`}</span>
                </div>
              </div>
            )}
            {/* Overlay text */}
            {slide.overlayText && (
              <div className="absolute inset-0 flex items-end p-3">
                <OverlayText slide={slide} />
              </div>
            )}
          </div>
        );
      })}

      {/* Slide indicator dots */}
      {slides.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          {slides.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === currentIndex ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/40"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OverlayText({ slide }: { slide: SlideshowItem }) {
  const animClass = (() => {
    switch (slide.overlayAnimation) {
      case 'scroll-left': return 'animate-marquee';
      case 'fade': return 'animate-pulse-glow';
      case 'blink': return 'animate-blink';
      case 'typewriter': return 'animate-typewriter overflow-hidden whitespace-nowrap';
      default: return '';
    }
  })();

  return (
    <div
      className={cn("whitespace-nowrap", animClass)}
      style={{
        fontSize: slide.overlayFontSize || 16,
        color: slide.overlayColor || '#ffffff',
        textShadow: '0 1px 4px rgba(0,0,0,0.7)',
        fontWeight: 600,
      }}
    >
      {slide.overlayText}
    </div>
  );
}

/* ── Standard Widget Preview ── */
function WidgetPreview({ widget, previewMode = false }: { widget: ContentWidget; previewMode?: boolean }) {
  if (widget.type === 'links') {
    return <LinksWidget widget={widget} interactive={previewMode} />;
  }
  if (widget.type === 'slideshow') {
    return <SlideshowPreview widget={widget} />;
  }

  // Determine animation class & custom duration
  const scrollDuration = widget.scrollDuration;
  const hasCustomDuration = scrollDuration && scrollDuration > 0;

  const animationClass = (() => {
    switch (widget.textAnimation) {
      case 'scroll-left':
        if (hasCustomDuration) return ''; // use inline style instead
        return widget.scrollSpeed === 'slow' ? 'animate-marquee-slow' : widget.scrollSpeed === 'fast' ? 'animate-marquee-fast' : 'animate-marquee';
      case 'scroll-up':
        return hasCustomDuration ? '' : 'animate-marquee-vertical';
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

  const customAnimStyle: React.CSSProperties = {};
  if (hasCustomDuration && widget.textAnimation === 'scroll-left') {
    customAnimStyle.animation = `marquee ${scrollDuration}s linear infinite`;
  } else if (hasCustomDuration && widget.textAnimation === 'scroll-up') {
    customAnimStyle.animation = `marquee-vertical ${scrollDuration}s linear infinite`;
  }

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
    const isScrolling = widget.textAnimation === 'scroll-left' || widget.textAnimation === 'scroll-right';
    const spacer = '\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0';
    const textContent = widget.text || 'Text';

    if (isScrolling) {
      const duration = hasCustomDuration ? scrollDuration : widget.scrollSpeed === 'slow' ? 20 : widget.scrollSpeed === 'fast' ? 5 : 10;
      return (
        <div style={{ ...style, overflow: 'hidden' }}>
          <div
            className="whitespace-nowrap flex"
            style={{
              fontSize: widget.fontSize,
              fontWeight: widget.fontWeight || '400',
              color: widget.textColor || '#ffffff',
              animation: `marquee-loop ${duration}s linear infinite`,
            }}
          >
            <span>{textContent}{spacer}</span>
            <span>{textContent}{spacer}</span>
          </div>
        </div>
      );
    }

    return (
      <div style={style}>
        <div className={cn("whitespace-nowrap", animationClass)} style={{
          fontSize: widget.fontSize,
          fontWeight: widget.fontWeight || '400',
          color: widget.textColor || '#ffffff',
          ...customAnimStyle,
        }}>
          {textContent}
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

  if (widget.type === 'image' || widget.type === 'video') {
    const fit = widget.objectFit || 'cover';
    if (widget.playlistEnabled && (widget.playlistItems?.length ?? 0) > 0) {
      return (
        <div style={style}>
          <PlaylistPlayer items={widget.playlistItems!} fit={fit} fallbackName={widget.mediaName} />
        </div>
      );
    }
    if (widget.type === 'image') {
      return (
        <div style={style} className="relative">
          {widget.mediaUrl ? (
            <img src={widget.mediaUrl} alt="" className="w-full h-full" style={{ objectFit: fit }} />
          ) : (
            <div className="flex flex-col items-center gap-1 text-muted-foreground">
              <div className="text-2xl">🖼️</div>
              <span className="text-xs">{widget.mediaName || 'No image'}</span>
            </div>
          )}
        </div>
      );
    }
    const cropLetterbox = fit === 'cover';
    return (
      <div style={style}>
        {widget.mediaUrl ? (
          <video
            src={widget.mediaUrl}
            className="block w-full h-full"
            style={{
              objectFit: fit,
              transform: cropLetterbox ? 'scale(1.12)' : undefined,
              transformOrigin: 'center',
            }}
            autoPlay
            muted
            loop
            playsInline
          />
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <div className="text-2xl">🎬</div>
            <span className="text-xs">{widget.mediaName || 'No video'}</span>
          </div>
        )}
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
  useEffect(() => {
    const interval = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(interval);
  }, []);
  return (
    <span style={{ fontSize: fontSize || 48, color: color || '#ffffff', fontWeight: fontWeight || '700' }}>
      {time}
    </span>
  );
}

/* ── Playlist Player (image + video, with optional time/day scheduling) ── */
function parseHM(s?: string): number | null {
  if (!s) return null;
  const [h, m] = s.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}
function isItemActive(item: PlaylistItem, now: Date): boolean {
  if (!item.scheduleEnabled) return true;
  const days = item.daysOfWeek;
  if (days && days.length && !days.includes(now.getDay())) return false;
  const start = parseHM(item.startTime);
  const end = parseHM(item.endTime);
  if (start == null && end == null) return true;
  const cur = now.getHours() * 60 + now.getMinutes();
  const s = start ?? 0;
  const e = end ?? 24 * 60;
  return s <= e ? cur >= s && cur < e : cur >= s || cur < e;
}

function PlaylistPlayer({
  items,
  fit,
  fallbackName,
}: {
  items: PlaylistItem[];
  fit: 'cover' | 'contain' | 'fill';
  fallbackName?: string;
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(i);
  }, []);

  const now = new Date();
  const active = items.filter((it) => it.mediaUrl && isItemActive(it, now));
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (active.length === 0) return;
    if (idx >= active.length) setIdx(0);
  }, [active.length, idx, tick]);

  const current = active[idx % Math.max(active.length, 1)];

  useEffect(() => {
    if (!current) return;
    if (current.mediaType === 'video' && (!current.duration || current.duration === 0)) return;
    const ms = Math.max(1, current.duration || 8) * 1000;
    const t = setTimeout(() => {
      setIdx((p) => (active.length ? (p + 1) % active.length : 0));
    }, ms);
    return () => clearTimeout(t);
  }, [current?.id, current?.duration, current?.mediaType, active.length]);

  if (active.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-muted-foreground">
        <div className="text-2xl">🕒</div>
        <span className="text-xs">
          {items.length === 0 ? (fallbackName || 'No playlist items') : 'No item scheduled for now'}
        </span>
      </div>
    );
  }

  if (!current) return null;

  if (current.mediaType === 'image') {
    return (
      <img
        key={current.id}
        src={current.mediaUrl}
        alt={current.mediaName}
        className="w-full h-full"
        style={{ objectFit: fit }}
      />
    );
  }

  return (
    <video
      key={current.id}
      src={current.mediaUrl}
      className="block w-full h-full"
      style={{ objectFit: fit }}
      autoPlay
      muted
      playsInline
      loop={active.length === 1 && (!current.duration || current.duration === 0)}
      onEnded={() => {
        if (!current.duration || current.duration === 0) {
          setIdx((p) => (active.length ? (p + 1) % active.length : 0));
        }
      }}
    />
  );
}



/* ── Zone Renderer ── */
export function ZoneRenderer({ zone, onUpdate, onSelectZone, selectedZoneId, depth = 0, previewMode = false }: ZoneRendererProps) {
  const isSelected = zone.id === selectedZoneId;
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const widgetType = e.dataTransfer.getData('widget-type') as ContentWidgetType;
    if (widgetType && zone.split === 'none') {
      const widget = createWidget(widgetType);
      onUpdate({ ...zone, content: widget });
    }
  }, [zone, onUpdate]);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (zone.split === 'none') setIsDragOver(true);
  }, [zone.split]);

  const handleSplit = (direction: 'horizontal' | 'vertical') => {
    onUpdate(splitZone(zone, direction));
  };

  const handleDelete = () => {
    onUpdate({ ...zone, content: null, split: 'none', children: null });
  };

  if (zone.split !== 'none' && zone.children) {
    const isH = zone.split === 'horizontal';
    return (
      <div className={cn("flex w-full h-full overflow-hidden", isH ? "flex-row" : "flex-col")} style={previewMode ? undefined : { gap: 2 }}>
        <div className="min-w-0 min-h-0 overflow-hidden" style={{ [isH ? 'width' : 'height']: `${zone.splitRatio}%`, [isH ? 'height' : 'width']: '100%' }}>
          <ZoneRenderer
            zone={zone.children[0]}
            onUpdate={(updated) => {
              const newChildren: [ScreenZone, ScreenZone] = [updated, zone.children![1]];
              onUpdate({ ...zone, children: newChildren });
            }}
            onSelectZone={onSelectZone}
            selectedZoneId={selectedZoneId}
            depth={depth + 1}
            previewMode={previewMode}
          />
        </div>
        {!previewMode && (
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
        )}
        <div className="min-w-0 min-h-0 overflow-hidden" style={{ [isH ? 'width' : 'height']: `${100 - zone.splitRatio}%`, [isH ? 'height' : 'width']: '100%' }}>
          <ZoneRenderer
            zone={zone.children[1]}
            onUpdate={(updated) => {
              const newChildren: [ScreenZone, ScreenZone] = [zone.children![0], updated];
              onUpdate({ ...zone, children: newChildren });
            }}
            onSelectZone={onSelectZone}
            selectedZoneId={selectedZoneId}
            depth={depth + 1}
            previewMode={previewMode}
          />
        </div>
      </div>
    );
  }

  if (previewMode) {
    return (
      <div className="relative w-full h-full">
        {zone.content ? <WidgetPreview widget={zone.content} previewMode /> : null}
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

      <div className={cn(
        "absolute top-1 right-1 flex gap-1 opacity-0 transition-opacity z-20",
        (isSelected || isDragOver) && "opacity-100",
        "group-hover/zone:opacity-100"
      )}>
        <Button variant="secondary" size="icon" className="h-6 w-6 bg-card/90 backdrop-blur-sm hover:bg-card"
          onClick={(e) => { e.stopPropagation(); handleSplit('horizontal'); }} title="Split Horizontally">
          <SplitSquareHorizontal className="h-3 w-3" />
        </Button>
        <Button variant="secondary" size="icon" className="h-6 w-6 bg-card/90 backdrop-blur-sm hover:bg-card"
          onClick={(e) => { e.stopPropagation(); handleSplit('vertical'); }} title="Split Vertically">
          <SplitSquareVertical className="h-3 w-3" />
        </Button>
        {zone.content && (
          <Button variant="secondary" size="icon"
            className="h-6 w-6 bg-card/90 backdrop-blur-sm hover:bg-destructive/90 hover:text-destructive-foreground"
            onClick={(e) => { e.stopPropagation(); handleDelete(); }} title="Clear">
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
