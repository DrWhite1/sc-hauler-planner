const { app, BrowserWindow, ipcMain, session, desktopCapturer } = require("electron");
const path = require("path");
const fs = require("fs");
const https = require("https");
const { exec } = require("child_process");
const os = require("os");
const voice = require("./voice");

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    backgroundColor: "#07080a",
    title: "SC Hauler Planner",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === "media" || permission === "microphone");
  });

  session.defaultSession.setPermissionCheckHandler((_wc, permission) => {
    return permission === "media" || permission === "microphone";
  });

  const staticPath = path.join(__dirname, "../out/index.html");
  if (fs.existsSync(staticPath)) {
    win.loadFile(staticPath);
  } else {
    win.loadURL("http://localhost:3000");
  }
}

function findAhk() {
  const candidates = [
    path.join(app.getPath("userData"), "AutoHotkey64.exe"),
    "C:\\Program Files\\AutoHotkey\\v2\\AutoHotkey64.exe",
    "C:\\Program Files\\AutoHotkey\\AutoHotkey.exe",
    "C:\\Program Files (x86)\\AutoHotkey\\AutoHotkey.exe",
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function toAhkKey(combo) {
  const parts = combo.toLowerCase().split("+").map((s) => s.trim());
  const mods = [];
  let key = "";
  for (const p of parts) {
    if (p === "alt") mods.push("Alt");
    else if (p === "ctrl" || p === "control") mods.push("Ctrl");
    else if (p === "shift") mods.push("Shift");
    else if (p === "win" || p === "windows") mods.push("LWin");
    else key = p;
  }
  if (!key) return null;
  return { mods, key };
}

function sendKey(key, duration) {
  const parsed = toAhkKey(key);
  if (!parsed) {
    console.log("invalid key combo:", key);
    return;
  }

  const hold = Math.max(0, parseInt(duration, 10) || 0);
  let ahkSend;

  if (hold > 0) {
    const downMods = parsed.mods.map((m) => `Send "{${m} down}"`).join("\n");
    const upMods = parsed.mods.map((m) => `Send "{${m} up}"`).join("\n");
    ahkSend = `${downMods}\nSend "{${parsed.key} down}"\nSleep ${hold}\nSend "{${parsed.key} up}"\n${upMods}`;
  } else {
    const modPrefix = parsed.mods.map((m) => {
      if (m === "Alt") return "!";
      if (m === "Ctrl") return "^";
      if (m === "Shift") return "+";
      if (m === "LWin") return "#";
      return "";
    }).join("");
    ahkSend = `Send "${modPrefix}${parsed.key}"`;
  }

  if (process.platform !== "win32") {
    const xdo = key.toLowerCase();
    const cmd = hold > 0
      ? `xdotool keydown ${xdo}; sleep ${hold / 1000}; xdotool keyup ${xdo}`
      : `xdotool key ${xdo}`;
    exec(cmd, (err) => {
      if (err) console.log("Linux: install xdotool with 'sudo apt install xdotool'");
      else console.log("xdotool sent:", key, hold ? `(${hold}ms)` : "");
    });
    return;
  }

  const ahk = findAhk();
  if (!ahk) {
    console.log("AutoHotkey not found. Install v2 from https://www.autohotkey.com/ then restart the app.");
    return;
  }

  const script = `#Requires AutoHotkey v2.0\nSendMode "Input"\n${ahkSend}\nExitApp\n`;
  const tmp = path.join(os.tmpdir(), `sc-key-${Date.now()}.ahk`);
  fs.writeFileSync(tmp, script);

  exec(`"${ahk}" "${tmp}"`, (err) => {
    if (err) console.log("ahk error:", err.message);
    else console.log("ahk sent:", key, hold ? `(${hold}ms)` : "");
    try { fs.unlinkSync(tmp); } catch {}
  });
}

ipcMain.on("send-key", (_e, payload) => {
  const key = typeof payload === "string" ? payload : payload.key;
  const duration = typeof payload === "object" ? payload.duration : 0;
  sendKey(key, duration);
});

ipcMain.handle("capture-screenshot", async () => {
  const sources = await desktopCapturer.getSources({ types: ["screen"], thumbnailSize: { width: 1920, height: 1080 } });
  if (!sources.length) return null;
  const img = sources[0].thumbnail;
  return img.toPNG().toString("base64");
});

ipcMain.handle("vosk-status", () => ({
  ready: voice.isModelReady(),
  path: voice.getModelPath(),
}));

ipcMain.handle("vosk-init", () => voice.init());

ipcMain.handle("vosk-audio", (_e, buffer) => {
  const buf = Buffer.from(buffer);
  return voice.acceptWaveform(buf);
});

ipcMain.handle("vosk-final", () => voice.finalResult());

ipcMain.handle("vosk-download", async () => {
  const url = "https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip";
  const dest = path.join(app.getPath("userData"), "vosk-model.zip");
  const extractTo = app.getPath("userData");

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      res.pipe(file);
      file.on("finish", () => {
        file.close();
        const cmd = process.platform === "win32"
          ? `powershell -NoProfile -Command "Expand-Archive -Path '${dest}' -DestinationPath '${extractTo}' -Force"`
          : `unzip -o '${dest}' -d '${extractTo}'`;
        exec(cmd, (err) => {
          if (err) reject(String(err));
          else resolve({ ok: true });
        });
      });
    }).on("error", reject);
  });
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});