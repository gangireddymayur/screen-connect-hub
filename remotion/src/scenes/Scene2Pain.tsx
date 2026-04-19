import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { C } from "../theme";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["400", "600", "700", "800"], subsets: ["latin"] });

const pains = [
  "USB sticks. Site visits. Frantic phone calls.",
  "One client adds a screen — your spreadsheet breaks.",
  "Updating 50 displays takes a Saturday.",
];

export const Scene2Pain: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Headline
  const headOp = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const headY = interpolate(frame, [0, 20], [30, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ fontFamily, color: C.text, padding: 120, justifyContent: "center" }}>
      <div
        style={{
          fontSize: 28,
          color: C.danger,
          fontWeight: 700,
          letterSpacing: 3,
          textTransform: "uppercase",
          opacity: headOp,
          transform: `translateY(${headY}px)`,
          marginBottom: 24,
        }}
      >
        The agency reality
      </div>
      <div
        style={{
          fontSize: 88,
          fontWeight: 800,
          letterSpacing: -3,
          lineHeight: 1.05,
          opacity: headOp,
          transform: `translateY(${headY}px)`,
          maxWidth: 1400,
          marginBottom: 80,
        }}
      >
        Managing screens for clients<br />
        <span style={{ color: C.danger }}>shouldn't be this painful.</span>
      </div>
      {pains.map((p, i) => {
        const start = 35 + i * 20;
        const op = interpolate(frame, [start, start + 18], [0, 1], { extrapolateRight: "clamp" });
        const x = interpolate(frame, [start, start + 25], [-40, 0], { extrapolateRight: "clamp" });
        const lineSp = spring({ frame: frame - start, fps, config: { damping: 18 } });
        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 24,
              marginBottom: 28,
              opacity: op,
              transform: `translateX(${x}px)`,
            }}
          >
            <div
              style={{
                width: 8 * lineSp,
                height: 56,
                background: C.danger,
                borderRadius: 2,
              }}
            />
            <div style={{ fontSize: 38, fontWeight: 500, color: C.textMuted }}>{p}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
