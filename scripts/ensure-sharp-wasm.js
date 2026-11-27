// Linux builds: make sure sharp's WebAssembly build is installed next to the native one.
// The OCR worker runs under the Electron binary, which links the system GLib; sharp's native
// libvips carries its own GLib and the two crash together on newer distros (GLib 2.90+).
// The worker uses @img/sharp-wasm32 there instead (see electron/ocr-worker.js).
// npm skips that package on x64 because it is marked cpu "wasm32", so install it explicitly.
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

if (process.platform !== "linux" && !process.argv.includes("--force")) process.exit(0);

const root = path.join(__dirname, "..");
const sharpVersion = require(path.join(root, "node_modules/sharp/package.json")).version;
const wasmPkg = path.join(root, "node_modules/@img/sharp-wasm32/package.json");
const installed = fs.existsSync(wasmPkg) ? require(wasmPkg).version : null;

if (installed === sharpVersion) {
  console.log(`@img/sharp-wasm32 ${installed} present`);
  process.exit(0);
}
console.log(`installing @img/sharp-wasm32@${sharpVersion} (was ${installed ?? "missing"})`);
execSync(
  `npm install --no-save --force --ignore-scripts --no-audit --no-fund @img/sharp-wasm32@${sharpVersion}`,
  { cwd: root, stdio: "inherit" }
);
