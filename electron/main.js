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

const VK = {
  a: 0x41, b: 0x42, c: 0x43, d: 0x44, e: 0x45, f: 0x46, g: 0x47, h: 0x48,
  i: 0x49, j: 0x4a, k: 0x4b, l: 0x4c, m: 0x4d, n: 0x4e, o: 0x4f, p: 0x50,
  q: 0x51, r: 0x52, s: 0x53, t: 0x54, u: 0x55, v: 0x56, w: 0x57, x: 0x58,
  y: 0x59, z: 0x5a,
  "0": 0x30, "1": 0x31, "2": 0x32, "3": 0x33, "4": 0x34,
  "5": 0x35, "6": 0x36, "7": 0x37, "8": 0x38, "9": 0x39,
};

function sendKey(key) {
  const k = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
  const vk = VK[k];
  if (!vk) return;

  if (process.platform === "win32") {
    const ps = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class Input {
  [DllImport("user32.dll")] public static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);
  [StructLayout(LayoutKind.Sequential)] public struct INPUT {
    public uint type;
    public InputUnion U;
  }
  [StructLayout(LayoutKind.Explicit)] public struct InputUnion {
    [FieldOffset(0)] public MOUSEINPUT mi;
    [FieldOffset(0)] public KEYBDINPUT ki;
  }
  [StructLayout(LayoutKind.Sequential)] public struct MOUSEINPUT { public int dx, dy; public uint mouseData, dwFlags, time; public IntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT { public ushort wVk, wScan; public uint dwFlags, time; public IntPtr dwExtraInfo; }
}
"@
$down = New-Object Input+INPUT
$down.type = 1
$down.U.ki.wVk = ${vk}
$up = New-Object Input+INPUT
$up.type = 1
$up.U.ki.wVk = ${vk}
$up.U.ki.dwFlags = 2
[Input]::SendInput(2, @($down, $up), [System.Runtime.InteropServices.Marshal]::SizeOf([type][Input+INPUT]))
`;
    exec(`powershell -NoProfile -Command "${ps.replace(/\n/g, " ").replace(/"/g, '\"')}"`);
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