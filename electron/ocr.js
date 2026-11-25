// Local screenshot OCR for contract screens (PaddleOCR models via ONNX runtime).
// Runs in the main process; nothing leaves the PC. The renderer falls back to tesseract.js
// if this module cannot load.
const fs = require("fs");
const os = require("os");
const path = require("path");

let enginePromise = null;
let tmpCounter = 0;

// The OCR package reads images from a file path, so write a temporary PNG and remove it after.
async function detectBuffer(ocr, pngBuffer) {
  const file = path.join(os.tmpdir(), `sc-ocr-${process.pid}-${Date.now()}-${tmpCounter++}.png`);
  fs.writeFileSync(file, pngBuffer);
  try {
    return await ocr.detect(file);
  } finally {
    try { fs.unlinkSync(file); } catch {}
  }
}

function loadEngine() {
  if (!enginePromise) {
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

async function recognizeRegion(ocr, sharp, buf, region, scale) {
  const out = await sharp(buf)
    .extract(region)
    .resize({ width: Math.round(region.width * scale) })
    .png()
    .toBuffer();
  return linesOf(await detectBuffer(ocr, out));
}

// Returns { header, objectives } text for a contract screenshot (image bytes), or throws.
async function readContract(bytes) {
  const sharp = require("sharp");
  const ocr = await loadEngine();
  const buf = Buffer.from(bytes);
  const meta = await sharp(buf).metadata();
  const W = meta.width;
  const H = meta.height;

  // Locate the PRIMARY OBJECTIVES heading to crop the objectives column (two layouts exist).
  const full = linesOf(await detectBuffer(ocr, await sharp(buf).png().toBuffer()));
  const heading = full.find((l) => norm(l.text).includes("primaryobjectives")) ?? full.find((l) => norm(l.text).includes("objectives"));
  const hb = heading ? bounds(heading) : null;
  const accept = hb
    ? full.map((l) => ({ l, b: bounds(l) })).find((x) => x.b && x.b.y0 > hb.y1 && norm(x.l.text).startsWith("accept"))
    : null;

  const x0 = Math.max(0, Math.floor(hb ? hb.x0 - W * 0.015 : W * 0.5));
  const y0 = Math.max(0, Math.floor(hb ? hb.y0 - H * 0.02 : 0));
  const y1 = Math.min(H, Math.ceil(accept ? accept.b.y0 : H * 0.92));
  const region = { left: x0, top: y0, width: Math.max(10, W - x0), height: Math.max(10, y1 - y0) };
  const objectives = await recognizeRegion(ocr, sharp, buf, region, 2);

  // Reward and corporation sit in the header box above the objectives.
  let header = [];
  const hy1 = hb ? Math.max(40, Math.floor(hb.y0)) : Math.floor(H * 0.3);
  const hregion = { left: x0, top: 0, width: Math.max(10, W - x0), height: Math.min(H, hy1) };
  header = await recognizeRegion(ocr, sharp, buf, hregion, 2);

  return { header: toText(header), objectives: toText(objectives), found: Boolean(hb) };
}

module.exports = { readContract, loadEngine };
