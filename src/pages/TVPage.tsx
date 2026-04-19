import { useEffect, useRef, useState, useCallback } from "react";
import { Tv, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "tv_device_id";

type Phase = "code" | "claiming" | "playing" | "error";

export default function TVPage() {
  const [phase, setPhase] = useState<Phase>("code");
  const [code, setCode] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState<string>("");
  const [layout, setLayout] = useState<any>(null);
  const heartbeatRef = useRef<number | null>(null);

  const resolution = `${window.screen.width}x${window.screen.height}`;

  const startHeartbeat = useCallback((deviceId: string) => {
    const ping = async () => {
      const { data, error } = await supabase.functions.invoke("device-heartbeat", {
        body: { device_id: deviceId },
      });
      if (error || (data as any)?.error) {
        // Device was removed/unpaired — go back to code entry
        localStorage.removeItem(STORAGE_KEY);
        setPhase("code");
        setLayout(null);
        return;
      }
      const d = (data as any)?.device;
      if (d?.name) setDeviceName(d.name);
      setLayout((data as any)?.layout ?? null);
    };
    ping();
    heartbeatRef.current = window.setInterval(ping, 30_000);
  }, []);

  // Resume session if previously paired
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setPhase("playing");
      startHeartbeat(stored);
    }
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [startHeartbeat]);

  const handlePair = async () => {
    if (code.length !== 6) return;
    setPhase("claiming");
    setErrorMsg(null);
    const { data, error } = await supabase.functions.invoke("claim-device-code", {
      body: { code, resolution },
    });
    if (error || (data as any)?.error) {
      setErrorMsg((data as any)?.error || error?.message || "Pairing failed");
      setPhase("error");
      return;
    }
    const deviceId = (data as any).device_id as string;
    localStorage.setItem(STORAGE_KEY, deviceId);
    setDeviceName((data as any).name ?? "");
    setPhase("playing");
    startHeartbeat(deviceId);
  };

  const unpair = () => {
    localStorage.removeItem(STORAGE_KEY);
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    setLayout(null);
    setCode("");
    setPhase("code");
  };

  // ===== PLAYING SCREEN =====
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
              Waiting for an admin to assign a layout. This screen will start playing automatically.
            </p>
          </div>
        )}
        <button
          onClick={unpair}
          className="absolute bottom-4 right-4 text-xs opacity-30 hover:opacity-100 transition px-3 py-1.5 rounded-md bg-white/10"
        >
          Unpair
        </button>
      </div>
    );
  }

  // ===== CODE ENTRY SCREEN =====
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex items-center justify-center p-8">
      <div className="w-full max-w-lg space-y-8 text-center">
        <div className="space-y-3">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/20 border border-primary/40 flex items-center justify-center">
            <Tv className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Pair this TV</h1>
          <p className="text-base text-white/60 max-w-sm mx-auto">
            Enter the 6-character code shown in your SignageHub admin dashboard.
          </p>
        </div>

        <div className="flex justify-center">
          <InputOTP
            maxLength={6}
            value={code}
            onChange={(v) => { setCode(v.toUpperCase()); setErrorMsg(null); if (phase === "error") setPhase("code"); }}
            disabled={phase === "claiming"}
          >
            <InputOTPGroup>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <InputOTPSlot
                  key={i}
                  index={i}
                  className="h-16 w-14 text-2xl font-mono bg-white/5 border-white/20 text-white"
                />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>

        {errorMsg && (
          <div className="flex items-center gap-2 justify-center text-sm text-red-400">
            <AlertCircle className="h-4 w-4" />
            <span>{errorMsg}</span>
          </div>
        )}

        <Button
          size="lg"
          onClick={handlePair}
          disabled={code.length !== 6 || phase === "claiming"}
          className="w-full h-12 text-base"
        >
          {phase === "claiming" ? (
            <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Pairing...</>
          ) : "Pair TV"}
        </Button>

        <p className="text-xs text-white/40">
          Screen resolution detected: {resolution}
        </p>
      </div>
    </div>
  );
}
