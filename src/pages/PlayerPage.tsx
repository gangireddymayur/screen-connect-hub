import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ZoneRenderer } from "@/components/screen-editor/ZoneRenderer";
import { createZone, type ScreenZone } from "@/lib/screen-editor-types";
import { ArrowLeft } from "lucide-react";

const API = (import.meta as any).env?.VITE_API_URL || "/api";

function getEmbedUrl(url: string | null): string {
  if (!url) return "";
  
  // Match standard, mobile, shorts, and sharing YouTube URLs to extract the 11-char Video ID
  const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=|shorts\/)|youtu\.be\/)([^"&?\/\s]{11})/i);
  if (ytMatch && ytMatch[1]) {
    return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&rel=0`;
  }
  
  return url;
}

interface PlayerLayout {
  id: string;
  name: string;
  resolution_width: number;
  resolution_height: number;
  background_color: string;
  layout_data: ScreenZone | null;
}

interface PlayerCompany {
  name: string;
  logo_url: string | null;
  show_brand_header: boolean;
}

export default function PlayerPage() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const [layout, setLayout] = useState<PlayerLayout | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [deviceName, setDeviceName] = useState("");
  const [company, setCompany] = useState<PlayerCompany | null>(null);
  const [timeString, setTimeString] = useState("");
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleOpenUrl = (e: Event) => {
      const url = (e as CustomEvent).detail?.url;
      if (url) {
        setActiveUrl(url);
      }
    };
    window.addEventListener("open-player-url", handleOpenUrl);
    return () => window.removeEventListener("open-player-url", handleOpenUrl);
  }, []);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeString(
        now.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

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
          setCompany(json?.company ?? null);
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
    <div className="fixed inset-0 overflow-hidden flex flex-col" style={{ backgroundColor: layout.background_color || "#000000" }}>
      {/* Brand Header */}
      {company?.show_brand_header && (
        <header className="h-16 bg-zinc-950/90 text-white flex items-center justify-between px-6 border-b border-zinc-800 shrink-0 z-50 select-none">
          <div className="flex items-center gap-3">
            {company.logo_url && (
              <img
                src={company.logo_url.startsWith("http") ? company.logo_url : company.logo_url}
                alt="Logo"
                className="h-8 w-8 object-contain rounded"
              />
            )}
            <span className="font-semibold text-base tracking-wide">{company.name}</span>
          </div>
          <div className="text-base font-semibold font-mono tabular-nums opacity-90">{timeString}</div>
        </header>
      )}
      <div className="relative flex-1 overflow-hidden">
        <ZoneRenderer
          zone={rootZone}
          onUpdate={() => {}}
          onSelectZone={() => {}}
          selectedZoneId={null}
          previewMode
        />
      </div>

      {/* Full Screen Web Link Overlay with Back Button */}
      {activeUrl && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col">
          <iframe
            src={getEmbedUrl(activeUrl)}
            className="flex-1 w-full h-full border-none"
            allow="autoplay; encrypted-media; fullscreen"
          />
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[110] select-none">
            <button
              onClick={() => setActiveUrl(null)}
              className="px-6 py-3 bg-zinc-950/95 hover:bg-zinc-900 text-white rounded-full border border-zinc-800 shadow-2xl flex items-center gap-2 text-sm font-semibold tracking-wide backdrop-blur transition-all active:scale-95 hover:scale-105"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Player</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

