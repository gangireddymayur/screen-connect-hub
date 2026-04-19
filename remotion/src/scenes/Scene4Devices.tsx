import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { C } from "../theme";
import { Sidebar } from "../components/Sidebar";
import { Card, TvIcon } from "../components/UIBits";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["400", "600", "700", "800"], subsets: ["latin"] });

const initialDevices = [
  { name: "Lobby Display", location: "HQ · Floor 1", paired: true, online: false },
  { name: "Cafe Menu Board", location: "Downtown", paired: true, online: false },
  { name: "Conference Room A", location: "HQ · Floor 3", paired: true, online: false },
  { name: "Storefront LED", location: "Mall Kiosk", paired: false, online: false },
  { name: "Window Display 2", location: "Outlet · West", paired: true, online: false },
];

export const Scene4Devices: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sidebarX = interpolate(spring({ frame, fps, config: { damping: 18 } }), [0, 1], [-260, 0]);

  // Devices come online one by one between frames 25 and 90
  const devices = initialDevices.map((d, i) => {
    const onlineFrame = 25 + i * 12;
    const isOnline = d.paired && frame >= onlineFrame;
    return { ...d, online: isOnline, onlineFrame };
  });

  // pairing code reveal
  const codeOp = interpolate(frame, [95, 115], [0, 1], { extrapolateRight: "clamp" });
  const codeY = interpolate(frame, [95, 115], [30, 0], { extrapolateRight: "clamp" });

  const pairChars = ["A", "7", "K", "9", "Q", "2"];

  return (
    <AbsoluteFill style={{ fontFamily, background: C.bg, color: C.text }}>
      <div style={{ display: "flex", height: "100%" }}>
        <div style={{ transform: `translateX(${sidebarX}px)` }}>
          <Sidebar active="Devices" />
        </div>
        <div style={{ flex: 1, padding: 56 }}>
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 42, fontWeight: 800, letterSpacing: -1 }}>Devices</div>
            <div style={{ fontSize: 18, color: C.textMuted, marginTop: 6 }}>
              Live status across every client location
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 24 }}>
            {/* Device list */}
            <Card style={{ padding: 0 }}>
              <div
                style={{
                  padding: "20px 28px",
                  borderBottom: `1px solid ${C.border}`,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div style={{ fontSize: 18, fontWeight: 700 }}>All Devices</div>
                <div style={{ fontSize: 14, color: C.textMuted }}>
                  {devices.filter((d) => d.online).length} online · {devices.length} total
                </div>
              </div>
              {devices.map((d, i) => {
                const rowOp = interpolate(frame, [10 + i * 5, 25 + i * 5], [0, 1], { extrapolateRight: "clamp" });
                const rowX = interpolate(frame, [10 + i * 5, 25 + i * 5], [30, 0], { extrapolateRight: "clamp" });
                const dotPulse = d.online
                  ? 0.6 + 0.4 * Math.abs(Math.sin((frame - d.onlineFrame) * 0.15))
                  : 1;
                const justOnlineFrames = frame - d.onlineFrame;
                const justOnline = d.online && justOnlineFrames < 10;

                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "20px 28px",
                      borderBottom: i < devices.length - 1 ? `1px solid ${C.border}` : "none",
                      opacity: rowOp,
                      transform: `translateX(${rowX}px)`,
                      background: justOnline ? `${C.success}15` : "transparent",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 10,
                          background: `${C.primary}22`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <TvIcon size={22} color={C.primaryGlow} />
                      </div>
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 600 }}>{d.name}</div>
                        <div style={{ fontSize: 14, color: C.textMuted, marginTop: 2 }}>{d.location}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 999,
                          background: !d.paired ? C.textMuted : d.online ? C.success : C.textMuted,
                          opacity: dotPulse,
                          boxShadow: d.online ? `0 0 12px ${C.success}` : "none",
                        }}
                      />
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: !d.paired ? C.textMuted : d.online ? C.success : C.textMuted,
                          minWidth: 80,
                          textAlign: "right",
                        }}
                      >
                        {!d.paired ? "Unpaired" : d.online ? "Online" : "Offline"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </Card>

            {/* Pairing card */}
            <Card style={{ opacity: codeOp, transform: `translateY(${codeY}px)`, padding: 32 }}>
              <div style={{ fontSize: 14, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>
                Pair a new screen
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 28 }}>
                Enter this code on the TV
              </div>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 28 }}>
                {pairChars.map((ch, i) => {
                  const charSp = spring({ frame: frame - 110 - i * 4, fps, config: { damping: 14 } });
                  return (
                    <div
                      key={i}
                      style={{
                        width: 70,
                        height: 86,
                        background: `linear-gradient(160deg, ${C.surfaceHi}, ${C.surface})`,
                        border: `2px solid ${C.primary}`,
                        borderRadius: 14,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 48,
                        fontWeight: 800,
                        color: C.primaryGlow,
                        boxShadow: `0 8px 24px ${C.primary}33`,
                        transform: `scale(${charSp}) rotateX(${(1 - charSp) * 60}deg)`,
                      }}
                    >
                      {ch}
                    </div>
                  );
                })}
              </div>
              <div
                style={{
                  padding: 16,
                  borderRadius: 12,
                  background: `${C.success}15`,
                  border: `1px solid ${C.success}55`,
                  color: C.success,
                  fontSize: 15,
                  fontWeight: 600,
                  textAlign: "center",
                  opacity: interpolate(frame, [140, 155], [0, 1], { extrapolateRight: "clamp" }),
                }}
              >
                ✓ Auto-resolves to 1920×1080 · Live in seconds
              </div>
            </Card>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
