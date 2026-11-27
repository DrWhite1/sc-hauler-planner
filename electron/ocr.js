// Local screenshot OCR for contract screens (PaddleOCR models via ONNX runtime).
// Runs in the main process; nothing leaves the PC. The renderer falls back to tesseract.js
// if this module cannot load.
const fs = require("fs");
const os = require("os");
const path = require("path");

let enginePromise = null;
let tmpCounter = 0;

// Timing for the current scan (written to ocr.log by the main process).
// Detection and recognition inference are timed by wrapping onnxruntime's session.run;
// the first session created is the detection model, the second the recognition model.
const now = () => Number(process.hrtime.bigint() / 1000n) / 1000; // ms
let timing = null;
let sessionsCreated = 0;
function instrumentOnnx() {
  try {
    const { InferenceSession } = require("onnxruntime-node");
    if (InferenceSession.__scTimed) return;
    InferenceSession.__scTimed = true;
    const create = InferenceSession.create;
    InferenceSession.create = async function (...args) {
      const session = await create.apply(this, args);
      session.__scKind = sessionsCreated++ === 0 ? "det" : "rec";
      return session;
    };
    const run = InferenceSession.prototype.run;
    InferenceSession.prototype.run = async function (...args) {
      const t = now();
      try {
        return await run.apply(this, args);
      } finally {
        if (timing && timing.current) {
          const kind = this.__scKind === "rec" ? "recMs" : "detMs";
          timing.current[kind] += now() - t;
          if (kind === "recMs") timing.current.recRuns++;
        }
      }
    };
  } catch {
    // Timing is best effort; never block OCR on it.
  }
}
const round = (ms) => Math.round(ms);

// The OCR package reads images from a file path, so write a temporary PNG and remove it after.
async function detectBuffer(ocr, pngBuffer, label) {
  const pass = { pass: label || "?", totalMs: 0, detMs: 0, recMs: 0, recRuns: 0 };
  if (timing) timing.current = pass;
  const t = now();
  const file = path.join(os.tmpdir(), `sc-ocr-${process.pid}-${Date.now()}-${tmpCounter++}.png`);
  fs.writeFileSync(file, pngBuffer);
  try {
    return await ocr.detect(file);
  } finally {
    try { fs.unlinkSync(file); } catch {}
    pass.totalMs = now() - t;
    if (timing) {
      timing.passes.push({
        pass: pass.pass,
        totalMs: round(pass.totalMs),
        detMs: round(pass.detMs),
        recMs: round(pass.recMs),
        recRuns: pass.recRuns,
        // image decode/resize/line splitting inside the OCR package
        otherMs: round(pass.totalMs - pass.detMs - pass.recMs),
      });
      timing.current = null;
    }
  }
}

function loadEngine() {
  if (!enginePromise) {
    instrumentOnnx();
    enginePromise = (async () => {
      const mod = await import("@gutenye/ocr-node");
      const Ocr = mod.default;
      return Ocr.create();
    })().catch((err) => {
      enginePromise = null;
      throw err;
    });
  }
  return enginePromise;
}

function linesOf(result) {
  const list = Array.isArray(result) ? result : result.lines ?? result.texts ?? [];
  return list.filter((l) => l && typeof l.text === "string");
}

function bounds(line) {
  const box = line.box;
  if (!box || !box.length) return null;
  const xs = box.map((p) => p[0]);
  const ys = box.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

const norm = (t) => t.replace(/[^a-z]/gi, "").toLowerCase();

// Order recognised lines top to bottom, left to right, as one text block.
function toText(lines) {
  return lines
    .map((l) => ({ l, b: bounds(l) }))
    .sort((a, c) => (a.b && c.b ? a.b.y0 - c.b.y0 || a.b.x0 - c.b.x0 : 0))
    .map((x) => x.l.text)
    .join("\n");
}

async function recognizeRegion(ocr, sharp, buf, region, scale, label) {
  const t = now();
  const out = await sharp(buf)
    .extract(region)
    .resize({ width: Math.round(region.width * scale) })
    .png()
    .toBuffer();
  if (timing) timing.cropMs += now() - t;
  return linesOf(await detectBuffer(ocr, out, label));
}

// Returns { header, objectives } text for a contract screenshot (image bytes), or throws.
// Adds `timing` to the result: { sharpLoadMs, modelLoadMs, cropMs, passes: [...] }.
async function readContract(bytes) {
  timing = { sharpLoadMs: 0, modelLoadMs: 0, cropMs: 0, passes: [], current: null };
  let t = now();
  const sharp = require("sharp");
  timing.sharpLoadMs = round(now() - t);
  t = now();
  const ocr = await loadEngine();
  timing.modelLoadMs = round(now() - t);
  const buf = Buffer.from(bytes);
  const meta = await sharp(buf).metadata();
  const W = meta.width;
  const H = meta.height;

  // Locate the PRIMARY OBJECTIVES heading to crop the objectives column (two layouts exist).
  const full = linesOf(await detectBuffer(ocr, await sharp(buf).png().toBuffer(), "full"));
  const heading = full.find((l) => norm(l.text).includes("primaryobjectives")) ?? full.find((l) => norm(l.text).includes("objectives"));
  const hb = heading ? bounds(heading) : null;
  const accept = hb
    ? full.map((l) => ({ l, b: bounds(l) })).find((x) => x.b && x.b.y0 > hb.y1 && norm(x.l.text).startsWith("accept"))
    : null;

  const x0 = Math.max(0, Math.floor(hb ? hb.x0 - W * 0.015 : W * 0.5));
  const y0 = Math.max(0, Math.floor(hb ? hb.y0 - H * 0.02 : 0));
  const y1 = Math.min(H, Math.ceil(accept ? accept.b.y0 : H * 0.92));
  const region = { left: x0, top: y0, width: Math.max(10, W - x0), height: Math.max(10, y1 - y0) };
  const objectives = await recognizeRegion(ocr, sharp, buf, region, 2, "objectives");

  // Reward and corporation sit in the header box above the objectives.
  let header = [];
  const hy1 = hb ? Math.max(40, Math.floor(hb.y0)) : Math.floor(H * 0.3);
  const hregion = { left: x0, top: 0, width: Math.max(10, W - x0), height: Math.min(H, hy1) };
  header = await recognizeRegion(ocr, sharp, buf, hregion, 2, "header");

  const { current, ...times } = timing;
  times.cropMs = round(times.cropMs);
  timing = null;
  return { header: toText(header), objectives: toText(objectives), found: Boolean(hb), timing: times };
}

module.exports = { readContract, loadEngine };
