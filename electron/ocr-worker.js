// One-shot OCR worker. Runs in plain Node mode (ELECTRON_RUN_AS_NODE) because the native
// ONNX runtime is not stable inside Electron's main process.
// Prints timings with the result so the main process can write them to ocr.log.
const startupMs = Math.round(process.uptime() * 1000);
const t0 = Date.now();
const fs = require("fs");

// Linux: the Electron binary links the system GLib/GObject, and sharp's native build carries
// its own GLib inside libvips. In one process sharp's g_object_* calls bind to the system copy
// and crash (SIGSEGV in g_object_unref with GLib 2.90, e.g. CachyOS/Arch). Use sharp's
// WebAssembly build here instead when it is installed (same API and output, no GLib clash).
let sharpBackend = "native";
if (process.platform === "linux" && process.versions.electron && !process.env.SC_OCR_NATIVE_SHARP) {
  try {
    require.resolve("@img/sharp-wasm32/sharp.node");
    const Module = require("module");
    const resolve = Module._resolveFilename;
    Module._resolveFilename = function (request, ...rest) {
      if (/^@img\/sharp-linux/.test(request) || /sharp-linux-[^/\\]*\.node$/.test(request)) {
        const err = new Error("native sharp disabled in the Electron OCR worker");
        err.code = "MODULE_NOT_FOUND";
        throw err;
      }
      return resolve.call(this, request, ...rest);
    };
    sharpBackend = "wasm";
  } catch {
    // WebAssembly build not installed: keep the native one.
  }
}
const { readContract } = require("./ocr");

(async () => {
  try {
    const bytes = fs.readFileSync(process.argv[2]);
    const result = await readContract(bytes);
    result.timing = { startupMs, sharp: sharpBackend, ...result.timing, workerMs: Date.now() - t0 };
    process.stdout.write("\n@@OCR@@" + JSON.stringify({ ok: true, ...result }) + "\n");
  } catch (err) {
    process.stdout.write(
      "\n@@OCR@@" +
        JSON.stringify({
          ok: false,
          error: String(err && err.message ? err.message : err),
          timing: { startupMs, sharp: sharpBackend, workerMs: Date.now() - t0 },
        }) +
        "\n"
    );
  }
  process.exit(0);
})();
