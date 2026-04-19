import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { C } from "../theme";
import { Sidebar } from "../components/Sidebar";
import { Card, HardDriveIcon, TvIcon, UsersIcon } from "../components/UIBits";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["400", "600", "700", "800"], subsets: ["latin"] });

const useCount = (frame: number, start: number, end: number, target: number) => {
  const t = interpolate(frame, [start, end], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // ease out
  const eased = 1 - Math.pow(1 - t, 3);
  return Math.round(eased * target);
};

export const Scene3Dashboard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // panel slide in
  const panelSp = spring({ frame, fps, config: { damping: 18 } });
  const sidebarX = interpolate(panelSp, [0, 1], [-260, 0]);

  // Plan badge upgrade animation: Starter (frame<60) -> Pro (60-100) -> Enterprise (100+)
  const planIndex = frame < 70 ? 0 : frame < 130 ? 1 : 2;
  const planColors = [C.starter, C.pro, C.enterprise];
  const planLabels = ["Starter", "Pro", "Enterprise"];
  const planQuotas = ["2 GB", "5 GB", "10 GB"];
  const planScreens = ["5 screens", "15 screens", "50 screens"];

  // Cards stagger
  const cardOp = (i: number) => interpolate(frame, [25 + i * 8, 45 + i * 8], [0, 1], { extrapolateRight: "clamp" });
  const cardY = (i: number) => interpolate(frame, [25 + i * 8, 45 + i * 8], [30, 0], { extrapolateRight: "clamp" });

  const screensCount = useCount(frame, 30, 70, planIndex === 0 ? 4 : planIndex === 1 ? 12 : 38);
  const storageGB = useCount(frame, 30, 70, planIndex === 0 ? 14 : planIndex === 1 ? 38 : 72) / 10; // 1.4, 3.8, 7.2
  const usersCount = useCount(frame, 30, 70, planIndex === 0 ? 3 : planIndex === 1 ? 8 : 24);

  const storageMax = planIndex === 0 ? 2 : planIndex === 1 ? 5 : 10;
  const storagePct = Math.min(100, (storageGB / storageMax) * 100);

  return (
    <AbsoluteFill style={{ fontFamily, background: C.bg, color: C.text }}>
      <div style={{ display: "flex", height: "100%" }}>
        <div style={{ transform: `translateX(${sidebarX}px)` }}>
          <Sidebar active="Dashboard" />
        </div>
        <div style={{ flex: 1, padding: 56, overflow: "hidden" }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 36 }}>
            <div>
              <div style={{ fontSize: 42, fontWeight: 800, letterSpacing: -1 }}>Dashboard</div>
              <div style={{ fontSize: 18, color: C.textMuted, marginTop: 6 }}>
                Welcome back to your control center
              </div>
            </div>
            {/* Plan badge — animates color/label */}
            <div
              key={planIndex}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "14px 22px",
                borderRadius: 14,
                background: `${planColors[planIndex]}1f`,
                border: `2px solid ${planColors[planIndex]}`,
                animation: undefined,
                transform: `scale(${spring({ frame: frame - (planIndex === 0 ? 0 : planIndex === 1 ? 70 : 130), fps, config: { damping: 12 } }) * 0.1 + 0.9})`,
              }}
            >
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 999,
                  background: planColors[planIndex],
                  boxShadow: `0 0 14px ${planColors[planIndex]}`,
                }}
              />
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: planColors[planIndex] }}>{planLabels[planIndex]}</div>
                <div style={{ fontSize: 13, color: C.textMuted, marginTop: 2 }}>
                  {planQuotas[planIndex]} · {planScreens[planIndex]}
                </div>
              </div>
            </div>
          </div>

          {/* Stat cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24, marginBottom: 32 }}>
            {[
              {
                label: "Active Screens",
                value: screensCount.toString(),
                sub: planScreens[planIndex],
                icon: <TvIcon size={26} color={C.primaryGlow} />,
                color: C.primary,
              },
              {
                label: "Storage Used",
                value: `${storageGB.toFixed(1)} GB`,
                sub: `of ${storageMax} GB`,
                icon: <HardDriveIcon size={26} color={C.accent} />,
                color: C.accent,
                progress: storagePct,
              },
              {
                label: "Team Members",
                value: usersCount.toString(),
                sub: "active this week",
                icon: <UsersIcon size={26} color={C.enterprise} />,
                color: C.enterprise,
              },
            ].map((s, i) => (
              <Card key={i} style={{ opacity: cardOp(i), transform: `translateY(${cardY(i)}px)` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
                  <div style={{ fontSize: 15, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.2 }}>
                    {s.label}
                  </div>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: `${s.color}22`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {s.icon}
                  </div>
                </div>
                <div style={{ fontSize: 54, fontWeight: 800, letterSpacing: -2, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 15, color: C.textMuted, marginTop: 8 }}>{s.sub}</div>
                {s.progress !== undefined && (
                  <div style={{ marginTop: 16, height: 8, background: `${C.text}11`, borderRadius: 4, overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${s.progress}%`,
                        background: `linear-gradient(90deg, ${s.color}, ${C.primaryGlow})`,
                        borderRadius: 4,
                        transition: undefined,
                      }}
                    />
                  </div>
                )}
              </Card>
            ))}
          </div>

          {/* Big call-out */}
          <Card style={{ opacity: cardOp(3), transform: `translateY(${cardY(3)}px)`, padding: 32 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 18, color: C.textMuted, fontWeight: 600, marginBottom: 8 }}>
                  Per-client plans, automatic quotas
                </div>
                <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: -1 }}>
                  Storage and screen limits update the moment you change a plan.
                </div>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 999,
                      background: i <= planIndex ? planColors[i] : `${C.text}22`,
                      boxShadow: i === planIndex ? `0 0 14px ${planColors[i]}` : "none",
                    }}
                  />
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AbsoluteFill>
  );
};
