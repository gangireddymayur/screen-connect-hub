import { useState } from "react";
import { ContentWidget, PlaylistItem, createPlaylistItem } from "@/lib/screen-editor-types";
import type { MediaContentItem } from "./ZoneProperties";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, ChevronDown, ChevronUp, Image as ImageIcon, Film, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const DAYS = [
  { v: 1, l: "Mon" },
  { v: 2, l: "Tue" },
  { v: 3, l: "Wed" },
  { v: 4, l: "Thu" },
  { v: 5, l: "Fri" },
  { v: 6, l: "Sat" },
  { v: 0, l: "Sun" },
];

function ItemEditor({
  item,
  index,
  total,
  mediaType,
  library,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  item: PlaylistItem;
  index: number;
  total: number;
  mediaType: 'image' | 'video';
  library: MediaContentItem[];
  onUpdate: (i: PlaylistItem) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [expanded, setExpanded] = useState(index === total - 1);
  const days = item.daysOfWeek ?? [0, 1, 2, 3, 4, 5, 6];

  const toggleDay = (d: number) => {
    const next = days.includes(d) ? days.filter((x) => x !== d) : [...days, d];
    onUpdate({ ...item, daysOfWeek: next });
  };

  return (
    <div className="rounded-lg border border-border bg-muted/30 overflow-hidden">
      <div
        className="flex items-center gap-2 p-2 cursor-pointer hover:bg-muted/50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0 overflow-hidden">
          {item.mediaUrl && item.mediaType === 'image' ? (
            <img src={item.mediaUrl} alt="" className="h-full w-full object-cover" />
          ) : item.mediaUrl && item.mediaType === 'video' ? (
            <Film className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">
            {index + 1}. {item.mediaName || `${item.mediaType} (empty)`}
          </p>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            {item.duration ? `${item.duration}s` : 'full video'}
            {item.scheduleEnabled && (
              <>
                <Clock className="h-2.5 w-2.5" />
                {item.startTime || '00:00'}–{item.endTime || '24:00'}
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {index > 0 && (
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); onMoveUp(); }}>
              <ChevronUp className="h-3 w-3" />
            </Button>
          )}
          {index < total - 1 && (
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); onMoveDown(); }}>
              <ChevronDown className="h-3 w-3" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-5 w-5 hover:text-destructive" onClick={(e) => { e.stopPropagation(); onRemove(); }}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="p-2.5 pt-0 space-y-3 border-t border-border/50">
          {library.length > 0 && (
            <div className="space-y-1 pt-2">
              <Label className="text-[10px]">Select {mediaType} from Library</Label>
              <div className="grid grid-cols-3 gap-1 max-h-[140px] overflow-y-auto">
                {library.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => onUpdate({ ...item, mediaUrl: m.file_url!, mediaName: m.name })}
                    className={cn(
                      "relative rounded overflow-hidden border aspect-video transition-all",
                      item.mediaUrl === m.file_url ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/40"
                    )}
                  >
                    {mediaType === 'image' ? (
                      <img src={m.file_url!} alt={m.name} className="w-full h-full object-cover" />
                    ) : (
                      <video src={m.file_url!} className="w-full h-full object-cover" muted preload="metadata" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-[10px]">
              {mediaType === 'video' ? `Duration (0 = full video, ${item.duration}s)` : `Duration (${item.duration}s)`}
            </Label>
            <Slider
              value={[item.duration]}
              onValueChange={([v]) => onUpdate({ ...item, duration: v })}
              min={mediaType === 'video' ? 0 : 1}
              max={120}
              step={1}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <Label className="text-[11px]">Schedule (time + days)</Label>
            <Switch
              checked={!!item.scheduleEnabled}
              onCheckedChange={(v) => onUpdate({ ...item, scheduleEnabled: v })}
            />
          </div>

          {item.scheduleEnabled && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px]">From</Label>
                  <Input
                    type="time"
                    value={item.startTime || '09:00'}
                    onChange={(e) => onUpdate({ ...item, startTime: e.target.value })}
                    className="h-7 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">To</Label>
                  <Input
                    type="time"
                    value={item.endTime || '17:00'}
                    onChange={(e) => onUpdate({ ...item, endTime: e.target.value })}
                    className="h-7 text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Days</Label>
                <div className="flex flex-wrap gap-1">
                  {DAYS.map((d) => {
                    const on = days.includes(d.v);
                    return (
                      <button
                        key={d.v}
                        onClick={() => toggleDay(d.v)}
                        className={cn(
                          "px-1.5 py-0.5 rounded text-[10px] border transition-colors",
                          on ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 border-border text-muted-foreground"
                        )}
                      >
                        {d.l}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function PlaylistEditor({
  widget,
  onUpdate,
  imageLibrary,
  videoLibrary,
}: {
  widget: ContentWidget;
  onUpdate: (w: ContentWidget) => void;
  imageLibrary: MediaContentItem[];
  videoLibrary: MediaContentItem[];
}) {
  const mediaType = widget.type === 'video' ? 'video' : 'image';
  const items = widget.playlistItems || [];
  const library = mediaType === 'video' ? videoLibrary : imageLibrary;

  const setItems = (next: PlaylistItem[]) => onUpdate({ ...widget, playlistItems: next });

  const add = () => setItems([...items, createPlaylistItem(mediaType)]);
  const update = (i: number, v: PlaylistItem) => {
    const next = [...items]; next[i] = v; setItems(next);
  };
  const remove = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const move = (from: number, to: number) => {
    const next = [...items]; const [it] = next.splice(from, 1); next.splice(to, 0, it); setItems(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-md bg-muted/40 border border-border p-2">
        <div>
          <Label className="text-xs font-semibold">Playlist Mode</Label>
          <p className="text-[10px] text-muted-foreground">Cycle through multiple {mediaType}s with optional time/day scheduling.</p>
        </div>
        <Switch
          checked={!!widget.playlistEnabled}
          onCheckedChange={(v) => onUpdate({ ...widget, playlistEnabled: v })}
        />
      </div>

      {widget.playlistEnabled && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">{items.length} item{items.length === 1 ? '' : 's'}</span>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={add}>
              <Plus className="h-3 w-3 mr-1" />
              Add {mediaType}
            </Button>
          </div>

          <div className="space-y-2">
            {items.map((it, i) => (
              <ItemEditor
                key={it.id}
                item={it}
                index={i}
                total={items.length}
                mediaType={mediaType}
                library={library}
                onUpdate={(v) => update(i, v)}
                onRemove={() => remove(i)}
                onMoveUp={() => move(i, i - 1)}
                onMoveDown={() => move(i, i + 1)}
              />
            ))}
            {items.length === 0 && (
              <p className="text-[11px] text-muted-foreground text-center py-3">
                No items yet. Click "Add {mediaType}" to start.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
