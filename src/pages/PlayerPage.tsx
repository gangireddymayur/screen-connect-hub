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
  const [isPaused, setIsPaused] = useState(false);
  const [deviceName, setDeviceName] = useState("");
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
          setIsPaused(!!json?.device?.is_paused);
          setDeviceName(json?.device?.name || "");
          setLayout(json.layout ?? null);
          setError(json.layout ? "" : (json?.device?.is_paused ? "" : "No layout assigned"));
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

  if (isPaused) {
    return (
      <div className="min-h-screen bg-radial from-[#2C1E14] to-[#0F0A07] text-white flex items-center justify-center p-6 select-none" style={{ background: "radial-gradient(950px at center, #2C1E14 0%, #0F0A07 100%)" }}>
        <div className="bg-white/5 border border-white/10 rounded-3xl px-14 py-11 max-w-lg w-full text-center space-y-5 backdrop-blur-md">
          <div className="flex items-center justify-center gap-2.5 text-[#FFB020] font-semibold text-lg">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FFB020]" />
            <span>TV paused</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">{deviceName || "SignageHub TV"}</h1>
          <p className="text-xl text-white/80 font-medium">Playback Paused</p>
          <p className="text-sm text-white/60 leading-relaxed px-2">
            This screen has been paused from the dashboard. Once resumed, it will instantly display layouts or schedule playlists again.
          </p>
        </div>
      </div>
    );
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

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ backgroundColor: layout.background_color || "#000000" }}>
      <div className="absolute inset-0 overflow-hidden">
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

