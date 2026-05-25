import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { ZoneRenderer } from "@/components/screen-editor/ZoneRenderer";
import { WidgetPalette } from "@/components/screen-editor/WidgetPalette";
import { ZoneProperties, type MediaContentItem } from "@/components/screen-editor/ZoneProperties";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  ScreenZone,
  ContentWidget,
  createZone,
} from "@/lib/screen-editor-types";
import {
  ArrowLeft,
  Save,
  Maximize,
  RotateCcw,
  Undo2,
  Redo2,
  LayoutGrid,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

function findZone(zone: ScreenZone, id: string): ScreenZone | null {
  if (zone.id === id) return zone;
  if (zone.children) {
    return findZone(zone.children[0], id) || findZone(zone.children[1], id);
  }
  return null;
}

function updateZoneContent(zone: ScreenZone, zoneId: string, widget: ContentWidget): ScreenZone {
  if (zone.id === zoneId) return { ...zone, content: widget };
  if (zone.children) {
    return {
      ...zone,
      children: [
        updateZoneContent(zone.children[0], zoneId, widget),
        updateZoneContent(zone.children[1], zoneId, widget),
      ],
    };
  }
  return zone;
}

function normalizeZoneForSave(zone: ScreenZone): ScreenZone {
  const content =
    zone.content?.type === "video"
      ? { ...zone.content, objectFit: "cover" as const }
      : zone.content;

  return {
    ...zone,
    content,
    children: zone.children
      ? [normalizeZoneForSave(zone.children[0]), normalizeZoneForSave(zone.children[1])]
      : null,
  };
}

type EditorSnapshot = { rootZone: ScreenZone; backgroundColor: string };

export default function AdminLayoutEditorPage() {
  const { layoutId } = useParams<{ layoutId: string }>();
  const navigate = useNavigate();

  const [layoutName, setLayoutName] = useState("");
  const [backgroundColor, setBackgroundColor] = useState("#1a1a2e");
  const [resWidth, setResWidth] = useState(1920);
  const [resHeight, setResHeight] = useState(1080);
  const [rootZone, setRootZone] = useState<ScreenZone>(() => createZone("root"));
  const snapshotRef = useRef<EditorSnapshot>({ rootZone: createZone("root"), backgroundColor: "#1a1a2e" });
  const [history, setHistory] = useState<{ past: EditorSnapshot[]; future: EditorSnapshot[] }>({ past: [], future: [] });
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [isFullPreview, setIsFullPreview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [contentItems, setContentItems] = useState<MediaContentItem[]>([]);

  const selectedZone = selectedZoneId ? findZone(rootZone, selectedZoneId) : null;
  const selectedWidget = selectedZone?.content || null;
  const canvasAspect = resWidth / resHeight;
  const canvasRatio = `${resWidth}/${resHeight}`;

  useEffect(() => {
    if (!layoutId) return;
    const fetchLayout = async () => {
      const { data, error } = await supabase
        .from("layouts")
        .select("*")
        .eq("id", layoutId)
        .single();
      if (error || !data) {
        toast.error("Layout not found");
        navigate("/admin/layouts");
        return;
      }
      setLayoutName(data.name);
      setBackgroundColor(data.background_color);
      setResWidth(data.resolution_width);
      setResHeight(data.resolution_height);
      const nextSnapshot: EditorSnapshot = {
        rootZone: createZone("root"),
        backgroundColor: data.background_color,
      };
      if (data.layout_data && typeof data.layout_data === "object" && (data.layout_data as any).id) {
        nextSnapshot.rootZone = data.layout_data as unknown as ScreenZone;
      } else {
        nextSnapshot.rootZone = createZone("root");
      }
      snapshotRef.current = nextSnapshot;
      setRootZone(nextSnapshot.rootZone);
      setHistory({ past: [], future: [] });

      // Fetch content items for this company
      const { data: contentData } = await supabase
        .from("content")
        .select("id, name, type, file_url")
        .eq("company_id", data.company_id)
        .order("created_at", { ascending: false });
      setContentItems(contentData ?? []);

      setLoading(false);
    };
    fetchLayout();
  }, [layoutId, navigate]);

  const commitSnapshot = useCallback((updater: (current: EditorSnapshot) => EditorSnapshot) => {
    const current = snapshotRef.current;
    const next = updater(current);
    snapshotRef.current = next;
    setHistory((prev) => ({ past: [...prev.past, current].slice(-50), future: [] }));
    setRootZone(next.rootZone);
    setBackgroundColor(next.backgroundColor);
  }, []);

  const handleZoneUpdate = useCallback((updatedRoot: ScreenZone) => {
    commitSnapshot((prev) => ({ ...prev, rootZone: updatedRoot }));
  }, [commitSnapshot]);

  const handleWidgetUpdate = useCallback(
    (widget: ContentWidget) => {
      if (!selectedZoneId) return;
      commitSnapshot((prev) => ({ ...prev, rootZone: updateZoneContent(prev.rootZone, selectedZoneId, widget) }));
    },
    [commitSnapshot, selectedZoneId]
  );

  const handleUndo = () => {
    setHistory((prev) => {
      if (prev.past.length === 0) return prev;
      const previous = prev.past[prev.past.length - 1];
      const current = snapshotRef.current;
      snapshotRef.current = previous;
      setRootZone(previous.rootZone);
      setBackgroundColor(previous.backgroundColor);
      setSelectedZoneId(null);
      return { past: prev.past.slice(0, -1), future: [current, ...prev.future].slice(0, 50) };
    });
  };

  const handleRedo = () => {
    setHistory((prev) => {
      if (prev.future.length === 0) return prev;
      const next = prev.future[0];
      const current = snapshotRef.current;
      snapshotRef.current = next;
      setRootZone(next.rootZone);
      setBackgroundColor(next.backgroundColor);
      setSelectedZoneId(null);
      return { past: [...prev.past, current].slice(-50), future: prev.future.slice(1) };
    });
  };

  const handleReset = () => {
    commitSnapshot((prev) => ({ ...prev, rootZone: createZone("root") }));
    setSelectedZoneId(null);
  };

  const handleSave = async () => {
    if (!layoutId) return;
    setSaving(true);
    const layoutData = normalizeZoneForSave(rootZone);
    const { error } = await supabase.from("layouts").update({
      layout_data: layoutData as any,
      background_color: backgroundColor,
      updated_at: new Date().toISOString(),
    }).eq("id", layoutId);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Layout saved!");
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </AdminLayout>
    );
  }

  if (isFullPreview) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ backgroundColor }}
        onClick={() => setIsFullPreview(false)}
      >
        <div
          className="max-w-full max-h-full overflow-hidden"
          style={{
            aspectRatio: canvasRatio,
            width: `min(100vw, calc(100vh * ${canvasAspect}))`,
            height: `min(100vh, calc(100vw / ${canvasAspect}))`,
          }}
        >
          <ZoneRenderer
            zone={rootZone}
            onUpdate={() => {}}
            onSelectZone={() => {}}
            selectedZoneId={null}
            previewMode
          />
        </div>
        <div className="absolute top-4 right-4">
          <Button variant="secondary" size="sm" onClick={() => setIsFullPreview(false)}>
            Exit Preview
          </Button>
        </div>
      </div>
    );
  }

  return (
    <AdminLayout>
      <div className="flex flex-col h-[calc(100vh-5rem)]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin/layouts")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <LayoutGrid className="h-4 w-4 text-primary" />
                <h1 className="text-lg font-bold tracking-tight">{layoutName}</h1>
              </div>
              <p className="text-xs text-muted-foreground">{resWidth}×{resHeight}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleUndo} disabled={history.past.length === 0}>
              <Undo2 className="h-3.5 w-3.5 mr-1.5" />
              Undo
            </Button>
            <Button variant="outline" size="sm" onClick={handleRedo} disabled={history.future.length === 0}>
              <Redo2 className="h-3.5 w-3.5 mr-1.5" />
              Redo
            </Button>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Reset
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsFullPreview(true)}>
              <Maximize className="h-3.5 w-3.5 mr-1.5" />
              Preview
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Save className="h-3.5 w-3.5 mr-1.5" />
              {saving ? "Saving..." : "Save Layout"}
            </Button>
          </div>
        </div>

        {/* Main Editor */}
        <div className="flex gap-4 flex-1 min-h-0">
          {/* Left Panel */}
          <div className="w-52 shrink-0">
            <ScrollArea className="h-full">
              <div className="pr-2 space-y-4">
                <WidgetPalette />
                <Separator />
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Canvas</h3>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Background</Label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={backgroundColor}
                        onChange={(e) => commitSnapshot((prev) => ({ ...prev, backgroundColor: e.target.value }))}
                        className="h-8 w-8 rounded cursor-pointer border-none"
                      />
                      <Input
                        value={backgroundColor}
                        onChange={(e) => commitSnapshot((prev) => ({ ...prev, backgroundColor: e.target.value }))}
                        className="h-8 text-xs font-mono flex-1"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>

          {/* Center - Canvas */}
          <div className="flex-1 flex items-center justify-center bg-muted/30 rounded-xl border border-border/50 overflow-hidden p-4">
            <div
              className="rounded-lg overflow-hidden shadow-lg border border-border/30 max-w-full max-h-full"
              style={{
                backgroundColor,
                aspectRatio: canvasRatio,
                width: "100%",
                height: "auto",
              }}
              onClick={() => setSelectedZoneId(null)}
            >
              <ZoneRenderer
                zone={rootZone}
                onUpdate={handleZoneUpdate}
                onSelectZone={setSelectedZoneId}
                selectedZoneId={selectedZoneId}
              />
            </div>
          </div>

          {/* Right Panel */}
          <div className="w-56 shrink-0">
            <ScrollArea className="h-full">
              <div className="pl-2">
                {selectedWidget ? (
                  <ZoneProperties widget={selectedWidget} onUpdate={handleWidgetUpdate} contentItems={contentItems} />
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <p className="text-sm font-medium">No zone selected</p>
                    <p className="text-xs mt-1">Click a zone or drop a widget to edit its properties</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
