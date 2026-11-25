const { app, BrowserWindow, ipcMain, session } = require("electron");
const path = require("path");
const { exec } = require("child_process");
const isDev = process.env.NODE_ENV === "development";

app.commandLine.appendSwitch("enable-features", "SpeechRecognition");
app.commandLine.appendSwitch("enable-speech-input");

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

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});