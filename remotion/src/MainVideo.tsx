import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { TransitionSeries, linearTiming, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { Background } from "./components/Background";
import { Scene1Hook } from "./scenes/Scene1Hook";
import { Scene2Pain } from "./scenes/Scene2Pain";
import { Scene3Dashboard } from "./scenes/Scene3Dashboard";
import { Scene3aContent } from "./scenes/Scene3aContent";
import { Scene3bLayout } from "./scenes/Scene3bLayout";
import { Scene4Devices } from "./scenes/Scene4Devices";
import { Scene4bSchedule } from "./scenes/Scene4bSchedule";
import { Scene5Features } from "./scenes/Scene5Features";
import { Scene6CTA } from "./scenes/Scene6CTA";
import { FPS } from "./theme";

// 90-second video, 8 scenes
// Scene durations (frames @ 30fps)
const D = {
  hook: 5 * FPS,        // 150 — 0-5s
  pain: 6 * FPS,        // 180 — 5-11s
  dash: 8 * FPS,        // 240 — 11-19s
  content: 8 * FPS,     // 240 — 19-27s
  layout: 30 * FPS,     // 900 — 27-57s  (BIG 30s scene)
  devices: 9 * FPS,     // 270 — 57-66s
  schedule: 7 * FPS,    // 210 — 66-73s
  features: 7 * FPS,    // 210 — 73-80s
  cta: 10 * FPS,        // 300 — 80-90s
  transition: 15,       // 0.5s overlap
};

// 8 sequences, 7 transitions; total = sum - 7*transition
export const TOTAL_FRAMES =
  D.hook + D.pain + D.dash + D.content + D.layout + D.devices + D.schedule + D.features + D.cta -
  7 * D.transition;

// Audio scene start frames (no overlap accounting — audio plays at scene start)
// We compute sequential, accounting for transitions. Audio starts roughly when each scene begins visually.
const AUDIO_STARTS = (() => {
  let t = 0;
  const list: number[] = [];
  const segs = [D.hook, D.pain, D.dash, D.content, D.layout, D.devices, D.schedule, D.features, D.cta];
  for (let i = 0; i < segs.length; i++) {
    list.push(t);
    t += segs[i] - D.transition;
  }
  return list;
})();

const tWipe = (dir: "from-left" | "from-right" | "from-top" | "from-bottom") =>
  ({ presentation: wipe({ direction: dir }), timing: linearTiming({ durationInFrames: D.transition }) });
const tFade = () =>
  ({ presentation: fade(), timing: linearTiming({ durationInFrames: D.transition }) });
const tSlide = (dir: "from-left" | "from-right" | "from-top" | "from-bottom") =>
  ({ presentation: slide({ direction: dir }), timing: springTiming({ durationInFrames: D.transition, config: { damping: 200 } }) });

const VO_FILES = [
  "vo/01-hook.mp3",
  "vo/02-pain.mp3",
  "vo/03-dashboard.mp3",
  "vo/04-content.mp3",
  "vo/05-layout.mp3",
  "vo/06-devices.mp3",
  "vo/07-schedule.mp3",
  "vo/08-features.mp3",
  "vo/09-cta.mp3",
];

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
      <TransitionSeries.Sequence durationInFrames={D.content}>
        <Scene3aContent />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition {...tSlide("from-right")} />
      <TransitionSeries.Sequence durationInFrames={D.layout}>
        <Scene3bLayout />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition {...tWipe("from-right")} />
      <TransitionSeries.Sequence durationInFrames={D.devices}>
        <Scene4Devices />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition {...tSlide("from-right")} />
      <TransitionSeries.Sequence durationInFrames={D.schedule}>
        <Scene4bSchedule />
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

    {/* Voiceover tracks — sequenced at scene starts */}
    {VO_FILES.map((f, i) => (
      <Sequence key={f} from={AUDIO_STARTS[i]}>
        <Audio src={staticFile(f)} volume={1} />
      </Sequence>
    ))}
  </AbsoluteFill>
);
