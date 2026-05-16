import { useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ZoneRenderer } from "@/components/screen-editor/ZoneRenderer";
import { WidgetPalette } from "@/components/screen-editor/WidgetPalette";
import { ZoneProperties } from "@/components/screen-editor/ZoneProperties";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ScreenLayout,
  ScreenZone,
  ContentWidget,
  createDefaultLayout,
} from "@/lib/screen-editor-types";
import { mockDevices } from "@/lib/mock-data";
import {
  ArrowLeft,
  Save,
  Maximize,
  RotateCcw,
  Undo2,
  Redo2,
  Monitor,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

function findZone(zone: ScreenZone, id: string): ScreenZone | null {
  if (zone.id === id) return zone;
  if (zone.children) {
    return findZone(zone.children[0], id) || findZone(zone.children[1], id);
  }
  return null;
}

function updateZoneContent(zone: ScreenZone, zoneId: string, widget: ContentWidget): ScreenZone {
  if (zone.id === zoneId) {
    return { ...zone, content: widget };
  }
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

export default function ScreenEditorPage() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const navigate = useNavigate();
  const device = mockDevices.find((d) => d.id === deviceId) || mockDevices[0];

  const [layout, setLayout] = useState<ScreenLayout>(() =>
    createDefaultLayout(device.id, `${device.name} Layout`)
  );
  const layoutRef = useRef(layout);
  const [history, setHistory] = useState<{ past: ScreenLayout[]; future: ScreenLayout[] }>({ past: [], future: [] });
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [isFullPreview, setIsFullPreview] = useState(false);

  const selectedZone = selectedZoneId ? findZone(layout.rootZone, selectedZoneId) : null;
  const selectedWidget = selectedZone?.content || null;

  const commitLayout = useCallback((updater: (current: ScreenLayout) => ScreenLayout) => {
    const current = layoutRef.current;
    const next = updater(current);
    layoutRef.current = next;
    setHistory((prev) => ({ past: [...prev.past, current].slice(-50), future: [] }));
    setLayout(next);
  }, []);

  const handleZoneUpdate = useCallback((updatedRoot: ScreenZone) => {
    commitLayout((prev) => ({ ...prev, rootZone: updatedRoot }));
  }, [commitLayout]);

  const handleUndo = () => {
    setHistory((prev) => {
      if (prev.past.length === 0) return prev;
      const previous = prev.past[prev.past.length - 1];
      const current = layoutRef.current;
      layoutRef.current = previous;
      setLayout(previous);
      setSelectedZoneId(null);
      return { past: prev.past.slice(0, -1), future: [current, ...prev.future].slice(0, 50) };
    });
  };

  const handleRedo = () => {
    setHistory((prev) => {
      if (prev.future.length === 0) return prev;
      const next = prev.future[0];
      const current = layoutRef.current;
      layoutRef.current = next;
      setLayout(next);
      setSelectedZoneId(null);
      return { past: [...prev.past, current].slice(-50), future: prev.future.slice(1) };
    });
  }, []);

  const handleWidgetUpdate = useCallback(
    (widget: ContentWidget) => {
      if (!selectedZoneId) return;
      commitLayout((prev) => ({
        ...prev,
        rootZone: updateZoneContent(prev.rootZone, selectedZoneId, widget),
      }));
    },
    [commitLayout, selectedZoneId]
  );

  const handleReset = () => {
    commitLayout(() => createDefaultLayout(device.id, `${device.name} Layout`));
    setSelectedZoneId(null);
  };

  if (isFullPreview) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ backgroundColor: layout.backgroundColor }}
        onClick={() => setIsFullPreview(false)}
      >
        <div className="w-full h-full max-w-[1920px] max-h-[1080px]" style={{ aspectRatio: '16/9' }}>
          <ZoneRenderer
            zone={layout.rootZone}
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
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-5rem)]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/devices")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <Monitor className="h-4 w-4 text-primary" />
                <h1 className="text-lg font-bold tracking-tight">{device.name}</h1>
              </div>
              <p className="text-xs text-muted-foreground">{device.location} · {device.resolution}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Reset
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsFullPreview(true)}>
              <Maximize className="h-3.5 w-3.5 mr-1.5" />
              Preview
            </Button>
            <Button size="sm">
              <Save className="h-3.5 w-3.5 mr-1.5" />
              Save Layout
            </Button>
          </div>
        </div>

        {/* Main Editor */}
        <div className="flex gap-4 flex-1 min-h-0">
          {/* Left Panel - Widget Palette */}
          <div className="w-52 shrink-0">
            <ScrollArea className="h-full">
              <div className="pr-2 space-y-4">
                <WidgetPalette />

                <Separator />

                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Canvas
                  </h3>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Background</Label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={layout.backgroundColor}
                        onChange={(e) => setLayout((p) => ({ ...p, backgroundColor: e.target.value }))}
                        className="h-8 w-8 rounded cursor-pointer border-none"
                      />
                      <Input
                        value={layout.backgroundColor}
                        onChange={(e) => setLayout((p) => ({ ...p, backgroundColor: e.target.value }))}
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
              className="w-full rounded-lg overflow-hidden shadow-lg border border-border/30"
              style={{
                backgroundColor: layout.backgroundColor,
                aspectRatio: '16/9',
                maxHeight: '100%',
              }}
              onClick={() => setSelectedZoneId(null)}
            >
              <ZoneRenderer
                zone={layout.rootZone}
                onUpdate={handleZoneUpdate}
                onSelectZone={setSelectedZoneId}
                selectedZoneId={selectedZoneId}
              />
            </div>
          </div>

          {/* Right Panel - Properties */}
          <div className="w-56 shrink-0">
            <ScrollArea className="h-full">
              <div className="pl-2">
                {selectedWidget ? (
                  <ZoneProperties widget={selectedWidget} onUpdate={handleWidgetUpdate} />
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
    </DashboardLayout>
  );
}
