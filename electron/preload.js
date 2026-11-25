const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  sendKey: (key) => ipcRenderer.send("send-key", key),
  voskStatus: () => ipcRenderer.invoke("vosk-status"),
  voskInit: () => ipcRenderer.invoke("vosk-init"),
  voskAudio: (buffer) => ipcRenderer.invoke("vosk-audio", buffer),
  voskFinal: () => ipcRenderer.invoke("vosk-final"),
  downloadModel: () => ipcRenderer.invoke("vosk-download"),
});