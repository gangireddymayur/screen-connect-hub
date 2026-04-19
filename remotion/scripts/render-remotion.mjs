import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition, openBrowser } from "@remotion/renderer";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] || "/mnt/documents/signagehub-promo.mp4";
const framesArg = process.argv[3]; // e.g. "0-90"

console.log("Bundling...");
const bundled = await bundle({
  entryPoint: path.resolve(__dirname, "../src/index.ts"),
  webpackOverride: (config) => config,
});

console.log("Opening browser...");
const browser = await openBrowser("chrome", {
  browserExecutable: process.env.PUPPETEER_EXECUTABLE_PATH ?? "/bin/chromium",
  chromiumOptions: { args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"] },
  chromeMode: "chrome-for-testing",
});

const composition = await selectComposition({
  serveUrl: bundled,
  id: "main",
  puppeteerInstance: browser,
});

let frameRange;
if (framesArg) {
  const [a, b] = framesArg.split("-").map(Number);
  frameRange = [a, b];
}

console.log(`Rendering ${composition.durationInFrames} frames @ ${composition.fps}fps -> ${out}`);
await renderMedia({
  composition,
  serveUrl: bundled,
  codec: "h264",
  outputLocation: out,
  puppeteerInstance: browser,
  muted: true,
  concurrency: 1,
  frameRange,
  onProgress: ({ progress }) => {
    if (Math.round(progress * 100) % 10 === 0) console.log(`  ${Math.round(progress * 100)}%`);
  },
});

await browser.close({ silent: false });
console.log("Done:", out);
