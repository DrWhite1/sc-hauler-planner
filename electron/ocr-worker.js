// One-shot OCR worker. Runs in plain Node mode (ELECTRON_RUN_AS_NODE) because the native
// ONNX runtime is not stable inside Electron's main process.
// Prints timings with the result so the main process can write them to ocr.log.
const startupMs = Math.round(process.uptime() * 1000);
const t0 = Date.now();
const fs = require("fs");

const { readContract } = require("./ocr");

(async () => {
  try {
    const bytes = fs.readFileSync(process.argv[2]);
    const result = await readContract(bytes);
    result.timing = { startupMs, ...result.timing, workerMs: Date.now() - t0 };
    process.stdout.write("\n@@OCR@@" + JSON.stringify({ ok: true, ...result }) + "\n");
  } catch (err) {
    process.stdout.write(
      "\n@@OCR@@" +
        JSON.stringify({
          ok: false,
          error: String(err && err.message ? err.message : err),
          timing: { startupMs, workerMs: Date.now() - t0 },
        }) +
        "\n"
    );
  }
  process.exit(0);
})();
