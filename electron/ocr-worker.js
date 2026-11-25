// One-shot OCR worker. Runs in plain Node mode (ELECTRON_RUN_AS_NODE) because the native
// ONNX runtime is not stable inside Electron's main process.
const fs = require("fs");
const { readContract } = require("./ocr");

(async () => {
  try {
    const bytes = fs.readFileSync(process.argv[2]);
    const result = await readContract(bytes);
    process.stdout.write("\n@@OCR@@" + JSON.stringify({ ok: true, ...result }) + "\n");
  } catch (err) {
    process.stdout.write("\n@@OCR@@" + JSON.stringify({ ok: false, error: String(err && err.message ? err.message : err) }) + "\n");
  }
  process.exit(0);
})();
