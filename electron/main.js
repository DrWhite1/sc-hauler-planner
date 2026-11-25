const { app, BrowserWindow, ipcMain, session } = require("electron");
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

function getAhkPath() {
  return path.join(app.getPath("userData"), "AutoHotkey64.exe");
}

function ensureAhk() {
  return new Promise((resolve, reject) => {
    const dest = getAhkPath();
    if (fs.existsSync(dest)) return resolve(dest);

    const url = "https://github.com/AutoHotkey/AutoHotkey/releases/download/v2.0.19/AutoHotkey_2.0.19_setup.exe";
    // Portable: download the zip and extract, or use a known portable build
    // For simplicity, download a portable exe if available, else instruct
    const portableUrl = "https://www.autohotkey.com/download/ahk.zip";
    const zipPath = path.join(app.getPath("userData"), "ahk.zip");

    const file = fs.createWriteStream(zipPath);
    https.get(portableUrl, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error("Could not download AutoHotkey"));
        return;
      }
      res.pipe(file);
      file.on("finish", () => {
        file.close();
        const extractCmd = `powershell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${app.getPath("userData")}' -Force"`;
        exec(extractCmd, (err) => {
          if (err) reject(err);
          else {
            // The zip contains AutoHotkey.exe or similar; rename if needed
            const extracted = path.join(app.getPath("userData"), "AutoHotkey.exe");
            if (fs.existsSync(extracted)) {
              fs.renameSync(extracted, dest);
            }
            resolve(dest);
          }
        });
      });
    }).on("error", reject);
  });
}

async function sendKey(key) {
  const k = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
  if (!k) return;

  if (process.platform !== "win32") {
    exec(`xdotool key ${k}`, (err) => {
      if (err) console.log("xdotool error (install with: sudo apt install xdotool):", err.message);
      else console.log("xdotool sent:", k);
    });
    return;
  }

  try {
    const ahk = await ensureAhk();
    const script = `#Requires AutoHotkey v2.0\nSendMode "Input"\nSend "{${k}}"\nExitApp\n`;
    const tmp = path.join(os.tmpdir(), `sc-key-${Date.now()}.ahk`);
    fs.writeFileSync(tmp, script);

    exec(`"${ahk}" "${tmp}"`, (err) => {
      if (err) console.log("ahk error:", err.message);
      else console.log("ahk sent:", k);
      try { fs.unlinkSync(tmp); } catch {}
    });
  } catch (err) {
    console.log("AutoHotkey setup failed:", err.message);
  }
}

ipcMain.on("send-key", (_e, key) => sendKey(key));

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