import { AbsoluteFill } from "remotion";
import { TransitionSeries, linearTiming, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { Background } from "./components/Background";
import { Scene1Hook } from "./scenes/Scene1Hook";
import { Scene2Pain } from "./scenes/Scene2Pain";
import { Scene3Dashboard } from "./scenes/Scene3Dashboard";
import { Scene4Devices } from "./scenes/Scene4Devices";
import { Scene5Features } from "./scenes/Scene5Features";
import { Scene6CTA } from "./scenes/Scene6CTA";
import { FPS } from "./theme";

// Scene durations (in frames @ 30fps) — total ~58s
// Hook 7s · Pain 8s · Dashboard 12s · Devices 11s · Features 10s · CTA 7s
// Transitions: 6 × ~0.7s overlap
const D = {
  hook: 7 * FPS,        // 210
  pain: 8 * FPS,        // 240
  dash: 12 * FPS,       // 360
  devices: 11 * FPS,    // 330
  features: 10 * FPS,   // 300
  cta: 7 * FPS,         // 210
  transition: 18,       // 0.6s
};

// Total = sum(scenes) - 5 transitions overlap
export const TOTAL_FRAMES = D.hook + D.pain + D.dash + D.devices + D.features + D.cta - 5 * D.transition;

const tWipe = (dir: "from-left" | "from-right" | "from-top" | "from-bottom") =>
  ({ presentation: wipe({ direction: dir }), timing: linearTiming({ durationInFrames: D.transition }) });
const tFade = () =>
  ({ presentation: fade(), timing: linearTiming({ durationInFrames: D.transition }) });
const tSlide = (dir: "from-left" | "from-right" | "from-top" | "from-bottom") =>
  ({ presentation: slide({ direction: dir }), timing: springTiming({ durationInFrames: D.transition, config: { damping: 200 } }) });

export const MainVideo: React.FC = () => (
  <AbsoluteFill>
    <Background />
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={D.hook}>
        <Scene1Hook />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition {...tFade()} />
      <TransitionSeries.Sequence durationInFrames={D.pain}>
        <Scene2Pain />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition {...tWipe("from-bottom")} />
      <TransitionSeries.Sequence durationInFrames={D.dash}>
        <Scene3Dashboard />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition {...tSlide("from-right")} />
      <TransitionSeries.Sequence durationInFrames={D.devices}>
        <Scene4Devices />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition {...tWipe("from-left")} />
      <TransitionSeries.Sequence durationInFrames={D.features}>
        <Scene5Features />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition {...tFade()} />
      <TransitionSeries.Sequence durationInFrames={D.cta}>
        <Scene6CTA />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  </AbsoluteFill>
);
