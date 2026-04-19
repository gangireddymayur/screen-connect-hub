import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Sequence } from "remotion";
import { C } from "../theme";
import { Sidebar } from "../components/Sidebar";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["400", "600", "700", "800"], subsets: ["latin"] });

// 30 seconds @ 30fps = 900 frames
// Storyline (frame ranges):
// 0-60   : Sidebar + page header + empty canvas (1 zone)
// 60-180 : Drag "Slideshow" widget into canvas → fills full zone (shows summer-sale video thumbnail)
// 180-330: Split canvas vertically → drag "Weather" into right panel
// 330-480: Split right-bottom → drag "Ticker" widget at bottom
// 480-660: Edit properties on Ticker (type "Welcome to ACME" appears in input, ticker shows live)
// 660-780: Background color picker — color shifts from dark to brand teal-tinted
// 780-900: Hit "Save Layout" → success toast, then preview button → expanding fullscreen reveal

const WIDGETS = [
  { id: "slideshow", label: "Slideshow", icon: "▶", color: C.primary },
  { id: "weather", label: "Weather", icon: "☀", color: C.accent },
  { id: "ticker", label: "Ticker", icon: "≡", color: C.enterprise },
  { id: "clock", label: "Clock", icon: "◔", color: C.success },
  { id: "rss", label: "RSS Feed", icon: "📡", color: C.danger },
  { id: "image", label: "Image", icon: "▣", color: C.primaryGlow },
];

const PROPS = [
  { label: "Text", value: "Welcome to ACME" },
  { label: "Speed", value: "Medium" },
  { label: "Color", value: "#14B8A6" },
];

const WidgetIcon: React.FC<{ kind: string; size?: number; color?: string }> = ({ kind, size = 24, color = "#fff" }) => {
  const s = { width: size, height: size, fill: "none", stroke: color, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (kind === "slideshow") return <svg viewBox="0 0 24 24" {...s}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M10 9l5 3-5 3z" fill={color} /></svg>;
  if (kind === "weather") return <svg viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" /></svg>;
  if (kind === "ticker") return <svg viewBox="0 0 24 24" {...s}><path d="M3 7h18M3 12h18M3 17h12" /></svg>;
  if (kind === "clock") return <svg viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
  if (kind === "rss") return <svg viewBox="0 0 24 24" {...s}><path d="M4 11a9 9 0 019 9M4 4a16 16 0 0116 16" /><circle cx="5" cy="19" r="1.5" fill={color} /></svg>;
  return <svg viewBox="0 0 24 24" {...s}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="M3 17l5-5 4 4 3-3 6 6" /></svg>;
};

export const Scene3bLayout: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sidebarX = interpolate(spring({ frame, fps, config: { damping: 18 } }), [0, 1], [-260, 0]);
  const headOp = interpolate(frame, [5, 25], [0, 1], { extrapolateRight: "clamp" });

  // Stage detection
  const slideshowDropFrame = 60;
  const splitVerticalFrame = 180;
  const weatherDropFrame = 220;
  const splitHorizFrame = 330;
  const tickerDropFrame = 380;
  const propsOpenFrame = 480;
  const typingFrame = 510;
  const bgChangeFrame = 660;
  const saveFrame = 780;
  const previewFrame = 840;

  // Slideshow widget — drag from palette into root zone
  const slideDrag = interpolate(frame, [slideshowDropFrame - 30, slideshowDropFrame], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const slideX = interpolate(slideDrag, [0, 1], [-720, 0]);
  const slideY = interpolate(slideDrag, [0, 1], [-50, 0]);
  const showSlideshow = frame >= slideshowDropFrame;
  const slideshowSp = spring({ frame: frame - slideshowDropFrame, fps, config: { damping: 14 } });

  // Vertical split happens at splitVerticalFrame
  const splitV = interpolate(frame, [splitVerticalFrame, splitVerticalFrame + 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // After split, the slideshow takes left (~60%), right is empty
  const leftPct = interpolate(splitV, [0, 1], [100, 60]);
  const rightPct = interpolate(splitV, [0, 1], [0, 40]);

  // Weather widget drag into right panel
  const weatherDrag = interpolate(frame, [weatherDropFrame - 30, weatherDropFrame], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const weatherX = interpolate(weatherDrag, [0, 1], [-820, 0]);
  const weatherY = interpolate(weatherDrag, [0, 1], [-120, 0]);
  const showWeather = frame >= weatherDropFrame;
  const weatherSp = spring({ frame: frame - weatherDropFrame, fps, config: { damping: 14 } });

  // Horizontal split inside right panel — weather top, ticker bottom
  const splitH = interpolate(frame, [splitHorizFrame, splitHorizFrame + 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const weatherHPct = interpolate(splitH, [0, 1], [100, 65]);
  const tickerHPct = interpolate(splitH, [0, 1], [0, 35]);

  // Ticker drag into bottom-right zone
  const tickerDrag = interpolate(frame, [tickerDropFrame - 30, tickerDropFrame], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const tickerX = interpolate(tickerDrag, [0, 1], [-820, 0]);
  const tickerY = interpolate(tickerDrag, [0, 1], [-50, 0]);
  const showTicker = frame >= tickerDropFrame;
  const tickerSp = spring({ frame: frame - tickerDropFrame, fps, config: { damping: 14 } });

  // Props panel open animation
  const propsSp = spring({ frame: frame - propsOpenFrame, fps, config: { damping: 18 } });

  // Typing: "Welcome to ACME" appears character by character starting typingFrame
  const fullText = "Welcome to ACME";
  const typedChars = Math.min(fullText.length, Math.max(0, Math.floor((frame - typingFrame) / 4)));
  const typedText = fullText.slice(0, typedChars);
  const cursor = Math.floor(frame / 8) % 2 === 0 ? "|" : " ";

  // Ticker scroll
  const tickerScroll = (frame * 4) % 800;

  // Background color shift
  const bgT = interpolate(frame, [bgChangeFrame, bgChangeFrame + 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const bgColor = bgT === 0 ? "#0F1623" : `rgb(${Math.round(15 + bgT * 5)}, ${Math.round(22 + bgT * 50)}, ${Math.round(35 + bgT * 60)})`;

  // Save toast
  const toastSp = spring({ frame: frame - saveFrame, fps, config: { damping: 14 } });
  const toastOp = interpolate(frame, [saveFrame, saveFrame + 15, saveFrame + 50, saveFrame + 65], [0, 1, 1, 0], { extrapolateRight: "clamp" });

  // Preview overlay zoom
  const previewSp = spring({ frame: frame - previewFrame, fps, config: { damping: 16 } });
  const previewOp = interpolate(frame, [previewFrame, previewFrame + 20], [0, 1], { extrapolateRight: "clamp" });

  // Slideshow image cycle (cycles through 3 "media items")
  const slideIndex = Math.floor((frame - slideshowDropFrame) / 60) % 3;
  const slideColors = [C.primary, C.accent, C.enterprise];
  const slideLabels = ["summer-sale.mp4", "menu-board.jpg", "promo-reel.mp4"];

  return (
    <AbsoluteFill style={{ fontFamily, background: C.bg, color: C.text }}>
      <div style={{ display: "flex", height: "100%" }}>
        <div style={{ transform: `translateX(${sidebarX}px)` }}>
          <Sidebar active="Layouts" />
        </div>

        <div style={{ flex: 1, padding: 32, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, opacity: headOp }}>
            <div>
              <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.5 }}>Layout Editor — Lobby Display</div>
              <div style={{ fontSize: 14, color: C.textMuted, marginTop: 2 }}>Drag widgets · Split zones · No code required</div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <div
                style={{
                  padding: "10px 18px",
                  borderRadius: 10,
                  border: `1px solid ${C.border}`,
                  fontSize: 14,
                  fontWeight: 600,
                  color: C.textMuted,
                }}
              >
                ⛶ Preview
              </div>
              <div
                style={{
                  padding: "10px 18px",
                  borderRadius: 10,
                  background: frame >= saveFrame ? C.success : `linear-gradient(135deg, ${C.primary}, ${C.primaryGlow})`,
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 700,
                  transform: frame >= saveFrame && frame < saveFrame + 10 ? `scale(${1 + (saveFrame + 10 - frame) * 0.02})` : "scale(1)",
                }}
              >
                {frame >= saveFrame ? "✓ Saved" : "💾 Save Layout"}
              </div>
            </div>
          </div>

          {/* Editor 3-column */}
          <div style={{ display: "flex", flex: 1, gap: 16, minHeight: 0 }}>
            {/* Left palette */}
            <div
              style={{
                width: 200,
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 14,
                padding: 16,
                opacity: headOp,
              }}
            >
              <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, letterSpacing: 1.5, marginBottom: 12, textTransform: "uppercase" }}>
                Widgets
              </div>
              {WIDGETS.map((w) => {
                // Highlight currently being "dragged" widget
                const isActive =
                  (w.id === "slideshow" && frame >= slideshowDropFrame - 30 && frame < slideshowDropFrame + 10) ||
                  (w.id === "weather" && frame >= weatherDropFrame - 30 && frame < weatherDropFrame + 10) ||
                  (w.id === "ticker" && frame >= tickerDropFrame - 30 && frame < tickerDropFrame + 10);
                return (
                  <div
                    key={w.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 12px",
                      borderRadius: 8,
                      background: isActive ? `${w.color}22` : "transparent",
                      border: `1px solid ${isActive ? w.color : "transparent"}`,
                      marginBottom: 6,
                      cursor: "grab",
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        background: `${w.color}33`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <WidgetIcon kind={w.id} size={16} color={w.color} />
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{w.label}</div>
                  </div>
                );
              })}
            </div>

            {/* Canvas */}
            <div
              style={{
                flex: 1,
                background: `${C.text}06`,
                border: `1px solid ${C.border}`,
                borderRadius: 14,
                padding: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* 16:9 canvas */}
              <div
                style={{
                  width: "100%",
                  aspectRatio: "16/9",
                  background: bgColor,
                  borderRadius: 10,
                  border: `1px solid ${C.border}`,
                  display: "flex",
                  overflow: "hidden",
                  position: "relative",
                  boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
                }}
              >
                {/* LEFT panel */}
                <div
                  style={{
                    width: `${leftPct}%`,
                    height: "100%",
                    borderRight: leftPct < 100 ? `2px solid ${C.primary}` : "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                    background: !showSlideshow ? `${C.text}04` : "transparent",
                  }}
                >
                  {!showSlideshow ? (
                    <div style={{ color: C.textMuted, fontSize: 16, fontWeight: 500 }}>Drop widget here</div>
                  ) : (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: `linear-gradient(135deg, ${slideColors[slideIndex]}88, ${slideColors[slideIndex]}33)`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexDirection: "column",
                        gap: 10,
                        opacity: slideshowSp,
                      }}
                    >
                      <div
                        style={{
                          width: 70,
                          height: 70,
                          borderRadius: 999,
                          background: "rgba(255,255,255,0.2)",
                          backdropFilter: undefined,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 32,
                          color: "#fff",
                        }}
                      >
                        ▶
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>{slideLabels[slideIndex]}</div>
                      {/* Slideshow dots */}
                      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                        {[0, 1, 2].map((i) => (
                          <div
                            key={i}
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 999,
                              background: i === slideIndex ? "#fff" : "rgba(255,255,255,0.4)",
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* RIGHT panel */}
                {rightPct > 0 && (
                  <div style={{ width: `${rightPct}%`, height: "100%", display: "flex", flexDirection: "column" }}>
                    {/* Top right (Weather) */}
                    <div
                      style={{
                        height: `${weatherHPct}%`,
                        borderBottom: weatherHPct < 100 ? `2px solid ${C.primary}` : "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: !showWeather ? `${C.text}04` : `linear-gradient(160deg, ${C.accent}aa, ${C.accent}44)`,
                        position: "relative",
                      }}
                    >
                      {!showWeather ? (
                        <div style={{ color: C.textMuted, fontSize: 14 }}>Drop widget</div>
                      ) : (
                        <div style={{ textAlign: "center", color: "#fff", opacity: weatherSp }}>
                          <div style={{ fontSize: 56, fontWeight: 800, lineHeight: 1 }}>72°</div>
                          <div style={{ fontSize: 16, fontWeight: 600, marginTop: 6 }}>☀ Sunny</div>
                          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>San Francisco</div>
                        </div>
                      )}
                    </div>

                    {/* Bottom right (Ticker) */}
                    {tickerHPct > 0 && (
                      <div
                        style={{
                          height: `${tickerHPct}%`,
                          background: !showTicker ? `${C.text}04` : C.enterprise,
                          display: "flex",
                          alignItems: "center",
                          overflow: "hidden",
                          position: "relative",
                        }}
                      >
                        {!showTicker ? (
                          <div style={{ width: "100%", textAlign: "center", color: C.textMuted, fontSize: 13 }}>
                            Drop widget
                          </div>
                        ) : (
                          <div
                            style={{
                              whiteSpace: "nowrap",
                              fontSize: 22,
                              fontWeight: 700,
                              color: "#fff",
                              transform: `translateX(${-tickerScroll}px)`,
                              opacity: tickerSp,
                            }}
                          >
                            {(typedText || "Welcome to ACME") + "   ★   " + (typedText || "Welcome to ACME") + "   ★   " + (typedText || "Welcome to ACME") + "   ★   "}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Phantom dragged widget overlay */}
                {frame >= slideshowDropFrame - 30 && frame < slideshowDropFrame && (
                  <div
                    style={{
                      position: "absolute",
                      left: "50%",
                      top: "50%",
                      transform: `translate(${slideX}px, ${slideY}px)`,
                      padding: "10px 16px",
                      background: C.surfaceHi,
                      border: `2px solid ${C.primary}`,
                      borderRadius: 8,
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      boxShadow: `0 12px 40px ${C.primary}aa`,
                    }}
                  >
                    <WidgetIcon kind="slideshow" size={20} color={C.primaryGlow} />
                    <div style={{ fontSize: 14, fontWeight: 700 }}>Slideshow</div>
                  </div>
                )}
                {frame >= weatherDropFrame - 30 && frame < weatherDropFrame && (
                  <div
                    style={{
                      position: "absolute",
                      left: "50%",
                      top: "50%",
                      transform: `translate(${weatherX}px, ${weatherY}px)`,
                      padding: "10px 16px",
                      background: C.surfaceHi,
                      border: `2px solid ${C.accent}`,
                      borderRadius: 8,
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      boxShadow: `0 12px 40px ${C.accent}aa`,
                    }}
                  >
                    <WidgetIcon kind="weather" size={20} color={C.accent} />
                    <div style={{ fontSize: 14, fontWeight: 700 }}>Weather</div>
                  </div>
                )}
                {frame >= tickerDropFrame - 30 && frame < tickerDropFrame && (
                  <div
                    style={{
                      position: "absolute",
                      left: "50%",
                      top: "50%",
                      transform: `translate(${tickerX}px, ${tickerY}px)`,
                      padding: "10px 16px",
                      background: C.surfaceHi,
                      border: `2px solid ${C.enterprise}`,
                      borderRadius: 8,
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      boxShadow: `0 12px 40px ${C.enterprise}aa`,
                    }}
                  >
                    <WidgetIcon kind="ticker" size={20} color={C.enterprise} />
                    <div style={{ fontSize: 14, fontWeight: 700 }}>Ticker</div>
                  </div>
                )}
              </div>

              {/* Save toast */}
              <div
                style={{
                  position: "absolute",
                  bottom: 24,
                  right: 24,
                  padding: "14px 22px",
                  background: C.success,
                  color: "#fff",
                  fontSize: 15,
                  fontWeight: 700,
                  borderRadius: 12,
                  boxShadow: `0 12px 40px ${C.success}66`,
                  opacity: toastOp,
                  transform: `translateY(${(1 - toastSp) * 30}px)`,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                ✓ Layout saved & deployed to screen
              </div>
            </div>

            {/* Right properties panel */}
            <div
              style={{
                width: 220,
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 14,
                padding: 16,
                opacity: headOp,
              }}
            >
              <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, letterSpacing: 1.5, marginBottom: 12, textTransform: "uppercase" }}>
                Properties
              </div>
              {frame < propsOpenFrame ? (
                <div style={{ fontSize: 12, color: C.textMuted, padding: 14, textAlign: "center" }}>
                  Select a zone to edit
                </div>
              ) : (
                <div style={{ opacity: propsSp }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.enterprise, marginBottom: 10 }}>
                    ≡ Ticker
                  </div>
                  {PROPS.map((p, i) => (
                    <div key={i} style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4, fontWeight: 600 }}>{p.label}</div>
                      <div
                        style={{
                          padding: "8px 10px",
                          background: C.surfaceHi,
                          border: `1px solid ${i === 0 && frame >= typingFrame && frame < typingFrame + fullText.length * 4 + 20 ? C.primaryGlow : C.border}`,
                          borderRadius: 6,
                          fontSize: 12,
                          fontFamily: i === 2 ? "monospace" : fontFamily,
                          color: i === 2 ? C.primaryGlow : C.text,
                          minHeight: 16,
                        }}
                      >
                        {i === 0 ? typedText + cursor : p.value}
                      </div>
                    </div>
                  ))}

                  {/* BG color swatch */}
                  <div style={{ marginTop: 18 }}>
                    <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
                      Canvas
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          background: bgColor,
                          border: `2px solid ${frame >= bgChangeFrame ? C.primaryGlow : C.border}`,
                        }}
                      />
                      <div style={{ fontSize: 11, fontFamily: "monospace", color: C.textMuted }}>
                        {bgColor}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Preview fullscreen overlay */}
          {frame >= previewFrame && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: bgColor,
                opacity: previewOp,
                transform: `scale(${0.85 + previewSp * 0.15})`,
                display: "flex",
                zIndex: 100,
              }}
            >
              {/* Same composition mirrored fullscreen */}
              <div style={{ width: "60%", background: `linear-gradient(135deg, ${slideColors[slideIndex]}88, ${slideColors[slideIndex]}33)`, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
                <div style={{ fontSize: 80, color: "#fff" }}>▶</div>
                <div style={{ fontSize: 36, fontWeight: 800, color: "#fff" }}>{slideLabels[slideIndex]}</div>
              </div>
              <div style={{ width: "40%", display: "flex", flexDirection: "column" }}>
                <div style={{ height: "65%", background: `linear-gradient(160deg, ${C.accent}aa, ${C.accent}44)`, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", color: "#fff" }}>
                  <div style={{ fontSize: 110, fontWeight: 800 }}>72°</div>
                  <div style={{ fontSize: 28, fontWeight: 600 }}>☀ Sunny · San Francisco</div>
                </div>
                <div style={{ height: "35%", background: C.enterprise, display: "flex", alignItems: "center", overflow: "hidden" }}>
                  <div style={{ whiteSpace: "nowrap", fontSize: 44, fontWeight: 700, color: "#fff", transform: `translateX(${-tickerScroll * 1.5}px)` }}>
                    Welcome to ACME   ★   Welcome to ACME   ★   Welcome to ACME   ★   
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
