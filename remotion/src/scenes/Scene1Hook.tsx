import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Sequence } from "remotion";
import { C } from "../theme";
import { Logo } from "../components/UIBits";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["400", "600", "700", "800"], subsets: ["latin"] });

export const Scene1Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({ frame, fps, config: { damping: 14, stiffness: 120 } });
  const titleY = interpolate(frame, [10, 35], [40, 0], { extrapolateRight: "clamp" });
  const titleOp = interpolate(frame, [10, 35], [0, 1], { extrapolateRight: "clamp" });
  const subY = interpolate(frame, [25, 50], [30, 0], { extrapolateRight: "clamp" });
  const subOp = interpolate(frame, [25, 50], [0, 1], { extrapolateRight: "clamp" });
  const tagOp = interpolate(frame, [50, 70], [0, 1], { extrapolateRight: "clamp" });
  const tagY = interpolate(frame, [50, 70], [20, 0], { extrapolateRight: "clamp" });

  // Floating screens in background
  const screens = [
    { x: 200, y: 200, delay: 0, w: 220, h: 130 },
    { x: 1500, y: 180, delay: 5, w: 240, h: 145 },
    { x: 150, y: 750, delay: 10, w: 260, h: 155 },
    { x: 1520, y: 760, delay: 15, w: 220, h: 130 },
  ];

  return (
    <AbsoluteFill style={{ fontFamily, color: C.text, alignItems: "center", justifyContent: "center" }}>
      {screens.map((s, i) => {
        const sf = spring({ frame: frame - s.delay, fps, config: { damping: 20 } });
        const drift = Math.sin((frame + i * 30) * 0.04) * 8;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: s.x,
              top: s.y + drift,
              width: s.w,
              height: s.h,
              borderRadius: 12,
              background: `linear-gradient(135deg, ${C.surface}, ${C.surfaceHi})`,
              border: `1px solid ${C.border}`,
              opacity: sf * 0.5,
              transform: `scale(${0.6 + sf * 0.4})`,
              boxShadow: `0 10px 40px ${C.primary}22`,
              overflow: "hidden",
            }}
          >
            <div style={{ height: 18, background: C.surfaceHi, borderBottom: `1px solid ${C.border}` }} />
            <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ height: 8, width: "70%", background: `${C.primary}55`, borderRadius: 4 }} />
              <div style={{ height: 6, width: "40%", background: `${C.text}22`, borderRadius: 4 }} />
              <div style={{ height: 6, width: "55%", background: `${C.text}22`, borderRadius: 4 }} />
            </div>
          </div>
        );
      })}

      <div style={{ transform: `scale(${logoScale})`, marginBottom: 32 }}>
        <Logo size={120} />
      </div>
      <div
        style={{
          fontSize: 96,
          fontWeight: 800,
          letterSpacing: -3,
          opacity: titleOp,
          transform: `translateY(${titleY}px)`,
          textAlign: "center",
        }}
      >
        SignageHub
      </div>
      <div
        style={{
          fontSize: 32,
          fontWeight: 500,
          color: C.textMuted,
          marginTop: 12,
          opacity: subOp,
          transform: `translateY(${subY}px)`,
          letterSpacing: -0.5,
        }}
      >
        White-label digital signage for agencies
      </div>
      <div
        style={{
          marginTop: 36,
          padding: "12px 24px",
          borderRadius: 999,
          background: `${C.primary}1f`,
          border: `1px solid ${C.primary}55`,
          color: C.primaryGlow,
          fontSize: 18,
          fontWeight: 600,
          opacity: tagOp,
          transform: `translateY(${tagY}px)`,
        }}
      >
        ● Multi-tenant · Per-client billing · Your brand
      </div>
    </AbsoluteFill>
  );
};
