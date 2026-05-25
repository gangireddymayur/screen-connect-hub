import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ZoneRenderer } from "@/components/screen-editor/ZoneRenderer";
import { createZone, type ScreenZone } from "@/lib/screen-editor-types";

const API = (import.meta as any).env?.VITE_API_URL || "/api";

interface PlayerLayout {
  id: string;
  name: string;
  resolution_width: number;
  resolution_height: number;
  background_color: string;
  layout_data: ScreenZone | null;
}

export default function PlayerPage() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const [layout, setLayout] = useState<PlayerLayout | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!deviceId) return;
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(`${API}/player/${deviceId}`, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error || `${res.status} ${res.statusText}`);
        if (!cancelled) {
          setLayout(json.layout ?? null);
          setError(json.layout ? "" : "No layout assigned");
          setLoading(false);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Player failed to load");
          setLoading(false);
        }
      }
    };

    load();
    const timer = window.setInterval(load, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [deviceId]);

  if (loading) {
    return <div className="min-h-screen bg-black text-white flex items-center justify-center text-sm">Loading screen...</div>;
  }

  if (error || !layout) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center text-center p-6">
        <div>
          <p className="text-xl font-semibold">Screen not ready</p>
          <p className="text-sm text-white/60 mt-2">{error || "Assign a layout to this device."}</p>
        </div>
      </div>
    );
  }

  const rootZone = layout.layout_data || createZone("root");
  const resolutionWidth = layout.resolution_width || 1920;
  const resolutionHeight = layout.resolution_height || 1080;
  const canvasAspect = resolutionWidth / resolutionHeight;

  return (
    <div className="fixed inset-0 overflow-hidden flex items-center justify-center" style={{ backgroundColor: layout.background_color || "#000000" }}>
      <div
        className="max-w-full max-h-full overflow-hidden"
        style={{
          aspectRatio: `${resolutionWidth}/${resolutionHeight}`,
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
    </div>
  );
}

