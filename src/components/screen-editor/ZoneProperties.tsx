import { ContentWidget, TextAnimation } from "@/lib/screen-editor-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

interface ZonePropertiesProps {
  widget: ContentWidget;
  onUpdate: (widget: ContentWidget) => void;
}

const animations: { value: TextAnimation; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'scroll-left', label: 'Scroll Left (Marquee)' },
  { value: 'scroll-right', label: 'Scroll Right' },
  { value: 'scroll-up', label: 'Scroll Up' },
  { value: 'typewriter', label: 'Typewriter' },
  { value: 'fade', label: 'Pulse / Fade' },
  { value: 'blink', label: 'Blink' },
];

export function ZoneProperties({ widget, onUpdate }: ZonePropertiesProps) {
  const update = (partial: Partial<ContentWidget>) => onUpdate({ ...widget, ...partial });

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Properties — {widget.label}
      </h3>

      {/* Text Content */}
      {(widget.type === 'text' || widget.type === 'rss') && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">Content</Label>
            <Textarea
              value={widget.text || ''}
              onChange={(e) => update({ text: e.target.value })}
              className="text-sm min-h-[60px] resize-none"
              placeholder="Enter text..."
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Font Size ({widget.fontSize}px)</Label>
            <Slider
              value={[widget.fontSize || 24]}
              onValueChange={([v]) => update({ fontSize: v })}
              min={8}
              max={120}
              step={1}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Font Weight</Label>
            <Select value={widget.fontWeight || '400'} onValueChange={(v) => update({ fontWeight: v })}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="300">Light</SelectItem>
                <SelectItem value="400">Normal</SelectItem>
                <SelectItem value="600">Semibold</SelectItem>
                <SelectItem value="700">Bold</SelectItem>
                <SelectItem value="800">Extra Bold</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Text Color</Label>
            <div className="flex gap-2">
              <input
                type="color"
                value={widget.textColor || '#ffffff'}
                onChange={(e) => update({ textColor: e.target.value })}
                className="h-8 w-8 rounded cursor-pointer border-none"
              />
              <Input
                value={widget.textColor || '#ffffff'}
                onChange={(e) => update({ textColor: e.target.value })}
                className="h-8 text-xs font-mono flex-1"
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label className="text-xs">Text Animation</Label>
            <Select value={widget.textAnimation || 'none'} onValueChange={(v) => update({ textAnimation: v as TextAnimation })}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {animations.map((a) => (
                  <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {widget.textAnimation && widget.textAnimation !== 'none' && (
            <div className="space-y-1.5">
              <Label className="text-xs">Scroll Speed</Label>
              <Select value={widget.scrollSpeed || 'normal'} onValueChange={(v) => update({ scrollSpeed: v as 'slow' | 'normal' | 'fast' })}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="slow">Slow</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="fast">Fast</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </>
      )}

      {/* Clock */}
      {widget.type === 'clock' && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">Font Size ({widget.fontSize}px)</Label>
            <Slider
              value={[widget.fontSize || 48]}
              onValueChange={([v]) => update({ fontSize: v })}
              min={16}
              max={120}
              step={1}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Color</Label>
            <div className="flex gap-2">
              <input
                type="color"
                value={widget.textColor || '#ffffff'}
                onChange={(e) => update({ textColor: e.target.value })}
                className="h-8 w-8 rounded cursor-pointer border-none"
              />
              <Input
                value={widget.textColor || '#ffffff'}
                onChange={(e) => update({ textColor: e.target.value })}
                className="h-8 text-xs font-mono flex-1"
              />
            </div>
          </div>
        </>
      )}

      {/* Image / Video */}
      {(widget.type === 'image' || widget.type === 'video') && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">Media Name</Label>
            <Input
              value={widget.mediaName || ''}
              onChange={(e) => update({ mediaName: e.target.value })}
              placeholder="e.g. promo-banner.jpg"
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Fit Mode</Label>
            <Select value={widget.objectFit || 'cover'} onValueChange={(v) => update({ objectFit: v as 'cover' | 'contain' | 'fill' })}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cover">Cover</SelectItem>
                <SelectItem value="contain">Contain</SelectItem>
                <SelectItem value="fill">Fill</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      <Separator />

      {/* Universal styling */}
      <div className="space-y-1.5">
        <Label className="text-xs">Background Color</Label>
        <div className="flex gap-2">
          <input
            type="color"
            value={widget.backgroundColor || '#000000'}
            onChange={(e) => update({ backgroundColor: e.target.value })}
            className="h-8 w-8 rounded cursor-pointer border-none"
          />
          <Input
            value={widget.backgroundColor || 'transparent'}
            onChange={(e) => update({ backgroundColor: e.target.value })}
            className="h-8 text-xs font-mono flex-1"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Padding ({widget.padding}px)</Label>
        <Slider
          value={[widget.padding || 0]}
          onValueChange={([v]) => update({ padding: v })}
          min={0}
          max={60}
          step={2}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Border Radius ({widget.borderRadius}px)</Label>
        <Slider
          value={[widget.borderRadius || 0]}
          onValueChange={([v]) => update({ borderRadius: v })}
          min={0}
          max={50}
          step={1}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Opacity ({widget.opacity}%)</Label>
        <Slider
          value={[widget.opacity ?? 100]}
          onValueChange={([v]) => update({ opacity: v })}
          min={10}
          max={100}
          step={5}
        />
      </div>
    </div>
  );
}
