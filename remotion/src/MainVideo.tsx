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
// Scene durations (frames @ 30fps) — sized to comfortably contain narration
const D = {
  hook: 6 * FPS,        // VO 5.2s
  pain: 7 * FPS,        // VO 6.6s
  dash: 8 * FPS,        // VO 7.1s
  content: 9 * FPS,     // VO 8.1s
  layout: 40 * FPS,     // VO 39s — 30s feels too tight, give it room
  devices: 9 * FPS,     // VO 8.0s
  schedule: 9 * FPS,    // VO 7.8s
  features: 8 * FPS,    // VO 7.4s
  cta: 13 * FPS,        // VO 12.4s
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
