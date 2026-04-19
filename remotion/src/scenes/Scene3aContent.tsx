import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { C } from "../theme";
import { Sidebar } from "../components/Sidebar";
import { Card } from "../components/UIBits";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["400", "600", "700", "800"], subsets: ["latin"] });

// Media items uploaded one-by-one
const media = [
  { name: "summer-sale.mp4", type: "video", size: "48 MB", color: C.primary, dur: "0:30" },
  { name: "menu-board.jpg", type: "image", size: "3.2 MB", color: C.accent },
  { name: "promo-reel.mp4", type: "video", size: "82 MB", color: C.primary, dur: "1:15" },
  { name: "logo-white.png", type: "image", size: "0.4 MB", color: C.accent },
  { name: "happy-hour.mp4", type: "video", size: "36 MB", color: C.primary, dur: "0:20" },
  { name: "team-photo.jpg", type: "image", size: "5.8 MB", color: C.accent },
];

const FileIcon: React.FC<{ type: string; color: string }> = ({ type, color }) => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
    {type === "video" ? (
      <>
        <rect x="2" y="6" width="14" height="12" rx="2" stroke={color} strokeWidth="2" />
        <path d="M16 10l6-3v10l-6-3z" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      </>
    ) : (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" stroke={color} strokeWidth="2" />
        <circle cx="9" cy="9" r="2" stroke={color} strokeWidth="2" />
        <path d="M3 17l5-5 4 4 3-3 6 6" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      </>
    )}
  </svg>
);

export const Scene3aContent: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sidebarX = interpolate(spring({ frame, fps, config: { damping: 18 } }), [0, 1], [-260, 0]);
  const headOp = interpolate(frame, [5, 25], [0, 1], { extrapolateRight: "clamp" });

  // Drop zone pulse
  const dropPulse = 0.7 + 0.3 * Math.abs(Math.sin(frame * 0.1));

  // A "phantom" file dragged into drop zone around frame 30-55
  const dragStart = 30;
  const dragEnd = 55;
  const dragT = interpolate(frame, [dragStart, dragEnd], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const dragX = interpolate(dragT, [0, 1], [-200, 380]);
  const dragY = interpolate(dragT, [0, 1], [-100, 60]);
  const dragOp = frame < dragStart ? 0 : frame > dragEnd + 5 ? 0 : 1;

  return (
    <AbsoluteFill style={{ fontFamily, background: C.bg, color: C.text }}>
      <div style={{ display: "flex", height: "100%" }}>
        <div style={{ transform: `translateX(${sidebarX}px)` }}>
          <Sidebar active="Content" />
        </div>
        <div style={{ flex: 1, padding: 56 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, opacity: headOp }}>
            <div>
              <div style={{ fontSize: 42, fontWeight: 800, letterSpacing: -1 }}>Media Library</div>
              <div style={{ fontSize: 18, color: C.textMuted, marginTop: 6 }}>
                Upload videos, images & logos — used across all your screens
              </div>
            </div>
            <div
              style={{
                padding: "12px 22px",
                borderRadius: 12,
                background: `linear-gradient(135deg, ${C.primary}, ${C.primaryGlow})`,
                color: "#fff",
                fontWeight: 700,
                fontSize: 16,
              }}
            >
              + Upload
            </div>
          </div>

          {/* Drop zone */}
          <div
            style={{
              position: "relative",
              border: `3px dashed ${C.primary}`,
              borderRadius: 18,
              padding: 36,
              background: `${C.primary}0a`,
              marginBottom: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 18,
              opacity: headOp,
              transform: `scale(${0.95 + dropPulse * 0.05})`,
            }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
              <path d="M12 16V4M12 4l-5 5M12 4l5 5" stroke={C.primaryGlow} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke={C.primaryGlow} strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: C.primaryGlow }}>Drop files here to upload</div>
              <div style={{ fontSize: 14, color: C.textMuted, marginTop: 4 }}>
                MP4, MOV, JPG, PNG · Up to 500 MB per file
              </div>
            </div>

            {/* Phantom dragged file */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: `translate(${dragX}px, ${dragY}px) rotate(${(1 - dragT) * -8}deg) scale(${0.9 + dragT * 0.1})`,
                opacity: dragOp,
                padding: "10px 18px",
                background: C.surfaceHi,
                border: `2px solid ${C.primaryGlow}`,
                borderRadius: 10,
                boxShadow: `0 12px 40px ${C.primary}66`,
                display: "flex",
                alignItems: "center",
                gap: 10,
                pointerEvents: "none",
              }}
            >
              <FileIcon type="video" color={C.primaryGlow} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>summer-sale.mp4</div>
                <div style={{ fontSize: 11, color: C.textMuted }}>48 MB</div>
              </div>
            </div>
          </div>

          {/* Media grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            {media.map((m, i) => {
              const start = 50 + i * 18;
              const sp = spring({ frame: frame - start, fps, config: { damping: 14 } });
              const op = interpolate(frame, [start, start + 18], [0, 1], { extrapolateRight: "clamp" });
              return (
                <Card
                  key={i}
                  style={{
                    opacity: op,
                    transform: `translateY(${(1 - sp) * 30}px) scale(${0.92 + sp * 0.08})`,
                    padding: 0,
                    overflow: "hidden",
                  }}
                >
                  {/* Thumbnail */}
                  <div
                    style={{
                      height: 110,
                      background: `linear-gradient(135deg, ${m.color}33, ${m.color}11)`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      position: "relative",
                    }}
                  >
                    <FileIcon type={m.type} color={m.color} />
                    {m.type === "video" && (
                      <div
                        style={{
                          position: "absolute",
                          bottom: 8,
                          right: 8,
                          background: "rgba(0,0,0,0.7)",
                          color: "#fff",
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: 4,
                        }}
                      >
                        ▶ {m.dur}
                      </div>
                    )}
                  </div>
                  <div style={{ padding: 14 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{m.name}</div>
                    <div style={{ fontSize: 12, color: C.textMuted }}>
                      {m.type.toUpperCase()} · {m.size}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
