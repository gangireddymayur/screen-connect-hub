import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { C } from "../theme";
import { Logo } from "../components/UIBits";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["400", "600", "700", "800"], subsets: ["latin"] });

export const Scene6CTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoSp = spring({ frame, fps, config: { damping: 14 } });
  const headOp = interpolate(frame, [10, 30], [0, 1], { extrapolateRight: "clamp" });
  const headY = interpolate(frame, [10, 30], [25, 0], { extrapolateRight: "clamp" });
  const subOp = interpolate(frame, [25, 45], [0, 1], { extrapolateRight: "clamp" });
  const ctaSp = spring({ frame: frame - 40, fps, config: { damping: 12, stiffness: 110 } });
  const urlOp = interpolate(frame, [55, 75], [0, 1], { extrapolateRight: "clamp" });

  // glowing pulse on the CTA
  const pulse = 0.6 + 0.4 * Math.abs(Math.sin(frame * 0.08));

  return (
    <AbsoluteFill style={{ fontFamily, color: C.text, alignItems: "center", justifyContent: "center" }}>
      <div style={{ transform: `scale(${logoSp})`, marginBottom: 28 }}>
        <Logo size={100} />
      </div>
      <div
        style={{
          fontSize: 86,
          fontWeight: 800,
          letterSpacing: -3,
          opacity: headOp,
          transform: `translateY(${headY}px)`,
          textAlign: "center",
          maxWidth: 1500,
          lineHeight: 1.05,
        }}
      >
        Launch your signage business <span style={{ color: C.primaryGlow }}>today.</span>
      </div>
      <div
        style={{
          fontSize: 28,
          color: C.textMuted,
          opacity: subOp,
          marginTop: 24,
          textAlign: "center",
          maxWidth: 1200,
          lineHeight: 1.4,
        }}
      >
        Plans from <span style={{ color: C.primaryGlow, fontWeight: 700 }}>$9/mo</span> · 2 GB storage included<br />
        Add screens, brand it your way, upgrade clients on demand.
      </div>
      <div
        style={{
          marginTop: 52,
          padding: "24px 56px",
          borderRadius: 999,
          background: `linear-gradient(135deg, ${C.primary}, ${C.primaryGlow})`,
          color: "#fff",
          fontSize: 32,
          fontWeight: 700,
          letterSpacing: -0.5,
          transform: `scale(${ctaSp})`,
          boxShadow: `0 ${10 + pulse * 20}px ${30 + pulse * 30}px ${C.primary}${Math.round(pulse * 200).toString(16).padStart(2, "0")}`,
        }}
      >
        Start free trial →
      </div>
      <div
        style={{
          marginTop: 32,
          fontSize: 22,
          color: C.primaryGlow,
          fontWeight: 600,
          opacity: urlOp,
          letterSpacing: 0.5,
        }}
      >
        signagehub.app
      </div>
    </AbsoluteFill>
  );
};
