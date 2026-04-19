import { useEffect, useRef, useState, useCallback } from "react";
import { Tv, Loader2, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "tv_device_id";

type Phase = "loading" | "showing_code" | "playing" | "error";

export default function TVPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [code, setCode] = useState<string>("");
  const [deviceId, setDeviceId] = useState<string>("");
  const [deviceName, setDeviceName] = useState<string>("");
  const [layout, setLayout] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  const resolution = `${window.screen.width}x${window.screen.height}`;

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const startPolling = useCallback((id: string) => {
    stopPolling();
    const tick = async () => {
      const { data, error } = await supabase.functions.invoke("tv-poll-status", { body: { device_id: id } });
      if (error || (data as any)?.error) {
        if ((data as any)?.reset) {
          // Device was deleted on server — restart pairing
          localStorage.removeItem(STORAGE_KEY);
          stopPolling();
          init();
        }
        return;
      }
      const d = (data as any)?.device;
      if (d?.is_paired) {
        setDeviceName(d.name);
        setLayout((data as any)?.layout ?? null);
        setPhase("playing");
      }
    };
    tick();
    pollRef.current = window.setInterval(tick, 4000);
  }, []);

  const init = useCallback(async () => {
    setPhase("loading");
    setErrorMsg(null);
    // Resume if already paired
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setDeviceId(stored);
      setPhase("playing");
      startPolling(stored);
      return;
    }
    // Generate a fresh code
    const { data, error } = await supabase.functions.invoke("generate-tv-code", { body: { resolution } });
    if (error || (data as any)?.error) {
      setErrorMsg((data as any)?.error || error?.message || "Could not generate code");
      setPhase("error");
      return;
    }
    const id = (data as any).device_id;
    const c = (data as any).code;
    setDeviceId(id);
    setCode(c);
    localStorage.setItem(STORAGE_KEY, id);
    setPhase("showing_code");
    startPolling(id);
  }, [resolution, startPolling]);

  useEffect(() => {
    init();
    return stopPolling;
  }, [init]);

  const handleReset = () => {
    localStorage.removeItem(STORAGE_KEY);
    stopPolling();
    setLayout(null);
    setCode("");
    setDeviceId("");
    setDeviceName("");
    init();
  };

  // ===== PLAYING =====
  if (phase === "playing") {
    return (
      <div
        className="fixed inset-0 overflow-hidden"
        style={{ background: layout?.background_color ?? "#0b0f1a", color: "white" }}
      >
        {layout ? (
          <div className="h-full w-full flex items-center justify-center">
            <div className="text-center space-y-4 px-8">
              <Tv className="h-16 w-16 mx-auto opacity-60" />
              <h1 className="text-5xl font-bold tracking-tight">{layout.name}</h1>
              <p className="text-xl opacity-70">Now playing on {deviceName}</p>
            </div>
          </div>
        ) : (
          <div className="h-full w-full flex flex-col items-center justify-center text-center space-y-6 px-8">
            <CheckCircle2 className="h-20 w-20 text-emerald-400" />
            <div>
              <h1 className="text-4xl font-bold mb-2">Paired successfully</h1>
              <p className="text-lg opacity-70">{deviceName}</p>
            </div>
            <p className="text-base opacity-50 max-w-md">
              Waiting for an admin to assign a layout. This screen will start automatically.
            </p>
          </div>
        )}
        <button
          onClick={handleReset}
          className="absolute bottom-4 right-4 text-xs opacity-30 hover:opacity-100 transition px-3 py-1.5 rounded-md bg-white/10"
        >
          Unpair
        </button>
      </div>
    );
  }

  // ===== ERROR =====
  if (phase === "error") {
    return (
      <div className="fixed inset-0 bg-slate-950 text-white flex items-center justify-center p-8">
        <div className="text-center space-y-4 max-w-md">
          <AlertCircle className="h-12 w-12 mx-auto text-red-400" />
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="text-white/60">{errorMsg}</p>
          <button onClick={init} className="px-4 py-2 rounded-md bg-white/10 hover:bg-white/20 text-sm">
            Try again
          </button>
        </div>
      </div>
    );
  }

  // ===== LOADING =====
  if (phase === "loading") {
    return (
      <div className="fixed inset-0 bg-slate-950 text-white flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-white/60" />
      </div>
    );
  }

  // ===== SHOWING CODE (TV is the source of truth) =====
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-black text-white flex items-center justify-center p-8">
      <div className="w-full max-w-3xl text-center space-y-10">
        <div className="space-y-3">
          <div className="mx-auto h-20 w-20 rounded-2xl bg-primary/20 border border-primary/40 flex items-center justify-center">
            <Tv className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Pair this TV</h1>
          <p className="text-lg md:text-xl text-white/60 max-w-xl mx-auto">
            On your computer, open <span className="text-primary font-semibold">SignageHub Admin → Devices → Pair Device</span> and enter this code:
          </p>
        </div>

        <div className="flex justify-center gap-3 md:gap-5">
          {code.split("").map((ch, i) => (
            <div
              key={i}
              className="h-32 w-24 md:h-40 md:w-28 rounded-2xl bg-white/5 border-2 border-primary/40 flex items-center justify-center font-mono text-6xl md:text-7xl font-bold text-primary shadow-2xl shadow-primary/20"
            >
              {ch}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center gap-2 text-sm text-white/40">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Waiting for pairing...</span>
        </div>

        <button
          onClick={handleReset}
          className="inline-flex items-center gap-2 text-xs text-white/40 hover:text-white/80 transition"
        >
          <RefreshCw className="h-3 w-3" /> Get a new code
        </button>
      </div>
    </div>
  );
}
