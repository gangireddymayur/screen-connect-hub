import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C } from "../theme";

export const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame * 0.4;
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, overflow: "hidden" }}>
      {/* drifting radial glows */}
      <div
        style={{
          position: "absolute",
          width: 1400,
          height: 1400,
          left: -300 + Math.sin(t * 0.01) * 60,
          top: -400 + Math.cos(t * 0.012) * 40,
          background: `radial-gradient(circle, ${C.primary}33 0%, transparent 60%)`,
          filter: "blur(40px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 1200,
          height: 1200,
          right: -300 + Math.cos(t * 0.008) * 80,
          bottom: -300 + Math.sin(t * 0.011) * 50,
          background: `radial-gradient(circle, ${C.enterprise}22 0%, transparent 60%)`,
          filter: "blur(40px)",
        }}
      />
      {/* subtle grid */}
      <svg
        width="100%"
        height="100%"
        style={{ position: "absolute", inset: 0, opacity: 0.06 }}
      >
        <defs>
          <pattern id="g" width="80" height="80" patternUnits="userSpaceOnUse">
            <path d="M 80 0 L 0 0 0 80" fill="none" stroke={C.text} strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#g)" />
      </svg>
    </AbsoluteFill>
  );
};
