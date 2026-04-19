import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { C } from "../theme";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["400", "600", "700", "800"], subsets: ["latin"] });

const features = [
  { title: "Drag-drop layout editor", desc: "Split zones, slideshows, tickers, weather, RSS — no code." },
  { title: "Weekly schedule calendar", desc: "Per-device dayparting with color-coded blocks." },
  { title: "Real-time device monitoring", desc: "Online status, last seen, auto-resolution detection." },
  { title: "Per-client plan tiers", desc: "Starter, Pro, Enterprise — with automatic quota enforcement." },
];

export const Scene5Features: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headOp = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const headY = interpolate(frame, [0, 18], [25, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ fontFamily, color: C.text, padding: 100, justifyContent: "center" }}>
      <div
        style={{
          fontSize: 26,
          color: C.primaryGlow,
          fontWeight: 700,
          letterSpacing: 3,
          textTransform: "uppercase",
          opacity: headOp,
          transform: `translateY(${headY}px)`,
          marginBottom: 18,
        }}
      >
        Built for resellers
      </div>
      <div
        style={{
          fontSize: 80,
          fontWeight: 800,
          letterSpacing: -2.5,
          lineHeight: 1.05,
          opacity: headOp,
          transform: `translateY(${headY}px)`,
          marginBottom: 70,
          maxWidth: 1500,
        }}
      >
        Everything you need.<br />
        <span style={{ color: C.primaryGlow }}>Nothing your clients don't.</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 28, maxWidth: 1500 }}>
        {features.map((f, i) => {
          const start = 30 + i * 14;
          const sp = spring({ frame: frame - start, fps, config: { damping: 16 } });
          const op = interpolate(frame, [start, start + 18], [0, 1], { extrapolateRight: "clamp" });
          return (
            <div
              key={i}
              style={{
                opacity: op,
                transform: `translateY(${(1 - sp) * 30}px) scale(${0.95 + sp * 0.05})`,
                padding: 32,
                borderRadius: 18,
                background: `linear-gradient(160deg, ${C.surface}, ${C.surfaceHi})`,
                border: `1px solid ${C.border}`,
                display: "flex",
                gap: 22,
                alignItems: "flex-start",
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: `linear-gradient(135deg, ${C.primary}, ${C.primaryGlow})`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  boxShadow: `0 6px 20px ${C.primary}55`,
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12l5 5L20 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 8, letterSpacing: -0.5 }}>{f.title}</div>
                <div style={{ fontSize: 18, color: C.textMuted, lineHeight: 1.5 }}>{f.desc}</div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
