import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { C } from "../theme";
import { Sidebar } from "../components/Sidebar";
import { Card } from "../components/UIBits";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["400", "600", "700", "800"], subsets: ["latin"] });

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const hours = ["8", "10", "12", "14", "16", "18", "20"];

// Schedule blocks: { day, startHour (0-7 grid), span, label, color }
const blocks = [
  { day: 0, start: 0, span: 4, label: "Morning Menu", color: C.primary, delay: 0 },
  { day: 0, start: 4, span: 3, label: "Happy Hour", color: C.accent, delay: 5 },
  { day: 1, start: 0, span: 4, label: "Morning Menu", color: C.primary, delay: 10 },
  { day: 1, start: 4, span: 3, label: "Happy Hour", color: C.accent, delay: 15 },
  { day: 2, start: 0, span: 5, label: "Lunch Special", color: C.success, delay: 20 },
  { day: 2, start: 5, span: 2, label: "Promo Reel", color: C.enterprise, delay: 25 },
  { day: 3, start: 0, span: 4, label: "Morning Menu", color: C.primary, delay: 30 },
  { day: 3, start: 4, span: 3, label: "Happy Hour", color: C.accent, delay: 35 },
  { day: 4, start: 0, span: 7, label: "Friday All-Day", color: C.danger, delay: 40 },
  { day: 5, start: 1, span: 5, label: "Weekend Brunch", color: C.primaryGlow, delay: 45 },
  { day: 6, start: 1, span: 5, label: "Weekend Brunch", color: C.primaryGlow, delay: 50 },
];

export const Scene4bSchedule: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sidebarX = interpolate(spring({ frame, fps, config: { damping: 18 } }), [0, 1], [-260, 0]);
  const headOp = interpolate(frame, [5, 25], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ fontFamily, background: C.bg, color: C.text }}>
      <div style={{ display: "flex", height: "100%" }}>
        <div style={{ transform: `translateX(${sidebarX}px)` }}>
          <Sidebar active="Schedule" />
        </div>
        <div style={{ flex: 1, padding: 56, opacity: headOp }}>
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 42, fontWeight: 800, letterSpacing: -1 }}>Weekly Schedule</div>
            <div style={{ fontSize: 18, color: C.textMuted, marginTop: 6 }}>
              Lobby Display · Dayparting by content block
            </div>
          </div>

          <Card style={{ padding: 28 }}>
            {/* Header row */}
            <div style={{ display: "grid", gridTemplateColumns: "60px repeat(7, 1fr)", gap: 6, marginBottom: 12 }}>
              <div />
              {days.map((d, i) => (
                <div key={i} style={{ fontSize: 14, fontWeight: 700, color: C.textMuted, textAlign: "center", textTransform: "uppercase", letterSpacing: 1 }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "60px repeat(7, 1fr)", gap: 6, position: "relative" }}>
              {/* Hour labels column */}
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {hours.map((h, i) => (
                  <div key={i} style={{ height: 48, fontSize: 12, color: C.textMuted, fontWeight: 600 }}>
                    {h}:00
                  </div>
                ))}
              </div>

              {/* Day columns with empty grid */}
              {days.map((_, dIdx) => (
                <div key={dIdx} style={{ position: "relative", display: "flex", flexDirection: "column", gap: 2 }}>
                  {hours.map((_, hIdx) => (
                    <div
                      key={hIdx}
                      style={{
                        height: 48,
                        background: `${C.text}06`,
                        borderRadius: 4,
                        border: `1px solid ${C.border}`,
                      }}
                    />
                  ))}

                  {/* Blocks for this day */}
                  {blocks
                    .filter((b) => b.day === dIdx)
                    .map((b, bi) => {
                      const op = interpolate(frame, [b.delay, b.delay + 18], [0, 1], { extrapolateRight: "clamp" });
                      const sp = spring({ frame: frame - b.delay, fps, config: { damping: 14 } });
                      return (
                        <div
                          key={bi}
                          style={{
                            position: "absolute",
                            top: b.start * 50,
                            left: 2,
                            right: 2,
                            height: b.span * 50 - 4,
                            background: `linear-gradient(160deg, ${b.color}, ${b.color}aa)`,
                            borderRadius: 6,
                            padding: "8px 10px",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "flex-start",
                            opacity: op,
                            transform: `scaleY(${sp}) translateY(${(1 - sp) * 10}px)`,
                            transformOrigin: "top",
                            boxShadow: `0 4px 14px ${b.color}55`,
                            color: "#fff",
                            overflow: "hidden",
                          }}
                        >
                          <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.2 }}>{b.label}</div>
                        </div>
                      );
                    })}
                </div>
              ))}
            </div>

            {/* Legend */}
            <div style={{ display: "flex", gap: 18, marginTop: 24, flexWrap: "wrap" }}>
              {[
                { c: C.primary, l: "Morning Menu" },
                { c: C.accent, l: "Happy Hour" },
                { c: C.success, l: "Lunch Special" },
                { c: C.enterprise, l: "Promo Reel" },
                { c: C.primaryGlow, l: "Weekend Brunch" },
              ].map((it, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: it.c }} />
                  <div style={{ fontSize: 13, color: C.textMuted, fontWeight: 600 }}>{it.l}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </AbsoluteFill>
  );
};
