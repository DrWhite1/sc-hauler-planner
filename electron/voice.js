const path = require("path");
const fs = require("fs");
const { app } = require("electron");

let model = null;
let recognizer = null;
let vosk = null;

function getModelPath() {
  const userData = app.getPath("userData");
  return path.join(userData, "vosk-model-small-en-us-0.15");
}

function isModelReady() {
  const p = getModelPath();
  return fs.existsSync(p) && fs.existsSync(path.join(p, "am", "final.mdl"));
}

function init() {
  if (!isModelReady()) return { ok: false, error: "Model not downloaded" };
  try {
    vosk = require("vosk");
    vosk.setLogLevel(-1);
    model = new vosk.Model(getModelPath());
    recognizer = new vosk.Recognizer({ model, sampleRate: 16000 });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

function acceptWaveform(buffer) {
  if (!recognizer) return null;
  const ok = recognizer.acceptWaveform(buffer);
  if (ok) {
    const res = recognizer.result();
    return res && res.text ? res.text : null;
  }
  const partial = recognizer.partialResult();
  return partial && partial.partial ? partial.partial : null;
}

function finalResult() {
  if (!recognizer) return null;
  const res = recognizer.finalResult();
  return res && res.text ? res.text : null;
}

module.exports = { getModelPath, isModelReady, init, acceptWaveform, finalResult };