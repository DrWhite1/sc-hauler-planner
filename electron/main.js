const { app, BrowserWindow, ipcMain, session } = require("electron");
const path = require("path");
const fs = require("fs");
const https = require("https");
const { exec } = require("child_process");
const voice = require("./voice");
const isDev = process.env.NODE_ENV === "development";

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

  if (isDev) {
    win.loadURL("http://localhost:3000");
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, "../out/index.html"));
  }
}

function sendKey(key) {
  const k = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
  if (!k) return;
  if (process.platform === "win32") {
    const ps = `powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${k}')"`;
    exec(ps);
  } else {
    exec(`xdotool key ${k}`);
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