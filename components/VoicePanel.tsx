"use client";

import { useState, useRef, useEffect } from "react";
import { useHaulerStore } from "@/lib/store";

declare global {
  interface Window {
    electronAPI?: {
      sendKey: (key: string) => void;
      voskStatus: () => Promise<{ ready: boolean; path: string }>;
      voskInit: () => Promise<{ ok: boolean; error?: string }>;
      voskAudio: (buffer: ArrayBuffer) => Promise<string | null>;
      voskFinal: () => Promise<string | null>;
      downloadModel: () => Promise<{ ok: boolean }>;
    };
  }
}

type Status = "unavailable" | "idle" | "listening" | "error" | "downloading";

export function VoicePanel() {
  const { voiceCommands, addVoiceCommand, removeVoiceCommand } = useHaulerStore();
  const [status, setStatus] = useState<Status>("idle");
  const [statusMsg, setStatusMsg] = useState("Checking model...");
  const [modelReady, setModelReady] = useState(false);
  const [lastHeard, setLastHeard] = useState("");
  const [lastMatch, setLastMatch] = useState("");
  const [newPhrase, setNewPhrase] = useState("");
  const [newKey, setNewKey] = useState("");
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const listeningRef = useRef(false);

  useEffect(() => {
    if (!window.electronAPI) {
      setStatus("unavailable");
      setStatusMsg("Run the desktop app to use voice");
      return;
    }
    window.electronAPI.voskStatus().then((s) => {
      setModelReady(s.ready);
      setStatus(s.ready ? "idle" : "error");
      setStatusMsg(s.ready ? "Ready - click Start" : "Model not found - click Download");
    });
  }, []);

  const download = async () => {
    if (!window.electronAPI) return;
    setStatus("downloading");
    setStatusMsg("Downloading model (~40 MB)...");
    try {
      await window.electronAPI.downloadModel();
      setModelReady(true);
      setStatus("idle");
      setStatusMsg("Model ready - click Start");
    } catch (err) {
      setStatus("error");
      setStatusMsg("Download failed: " + String(err));
    }
  };

  const start = async () => {
    if (!window.electronAPI || !modelReady) return;
    const init = await window.electronAPI.voskInit();
    if (!init.ok) {
      setStatus("error");
      setStatusMsg("Init failed: " + (init.error || "unknown"));
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext({ sampleRate: 16000 });
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = async (e) => {
        if (!listeningRef.current) return;
        const input = e.inputBuffer.getChannelData(0);
        const buffer = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          buffer[i] = Math.max(-32768, Math.min(32767, input[i] * 32768));
        }
        const text = await window.electronAPI!.voskAudio(buffer.buffer);
        if (text) {
          setLastHeard(text);
          const match = voiceCommands.find((c) => text.toLowerCase().includes(c.phrase.toLowerCase()));
          if (match) {
            setLastMatch(match.phrase + " -> " + match.key.toUpperCase());
            setStatusMsg("Matched: " + match.phrase);
            window.electronAPI!.sendKey(match.key);
          }
        }
      };

      source.connect(processor);
      processor.connect(ctx.destination);
      listeningRef.current = true;
      setStatus("listening");
      setStatusMsg("Listening... speak a command");
    } catch (err) {
      setStatus("error");
      setStatusMsg("Mic error: " + String(err));
    }
  };

  const stop = () => {
    listeningRef.current = false;
    processorRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setStatus("idle");
    setStatusMsg("Stopped");
  };

  const toggle = () => (listeningRef.current ? stop() : start());

  const testKey = () => {
    if (window.electronAPI) {
      window.electronAPI.sendKey("t");
      setStatusMsg("Sent test key T");
    }
  };

  const add = () => {
    if (!newPhrase.trim() || !newKey.trim()) return;
    addVoiceCommand(newPhrase.trim().toLowerCase(), newKey.trim().toLowerCase());
    setNewPhrase("");
    setNewKey("");
  };

  const statusColor =
    status === "listening" ? "text-sage" :
    status === "error" ? "text-red-400" :
    status === "downloading" ? "text-gold" : "text-accent/50";

  return (
    <div className="panel p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-medium uppercase tracking-wider text-accent/50">Voice</h3>
        <button
          onClick={toggle}
          disabled={!modelReady || status === "downloading"}
          className={`text-[10px] px-2 py-0.5 rounded transition ${
            status === "listening"
              ? "bg-sage text-ink"
              : "border border-elevated text-accent/70 hover:bg-ink"
          }`}
        >
          {status === "listening" ? "Stop" : "Start"}
        </button>
      </div>

      <div className={`flex items-center gap-2 text-[10px] mb-2 ${statusColor}`}>
        <span
          className={`w-2 h-2 rounded-full ${
            status === "listening" ? "bg-sage animate-pulse" :
            status === "error" ? "bg-red-400" :
            status === "downloading" ? "bg-gold" : "bg-accent/30"
          }`}
        />
        <span>{statusMsg}</span>
      </div>

      {!modelReady && status !== "downloading" && (
        <button onClick={download} className="text-[10px] mb-2 text-gold hover:underline">
          Download model (~40 MB)
        </button>
      )}

      {lastHeard && (
        <p className="text-[10px] text-accent/50 mb-1">
          Heard: <span className="text-accent">{lastHeard}</span>
        </p>
      )}
      {lastMatch && (
        <p className="text-[10px] text-gold mb-2">Last match: {lastMatch}</p>
      )}

      <button onClick={testKey} className="text-[10px] mb-2 text-accent/50 hover:text-accent underline">
        Test key send (T)
      </button>

      <ul className="space-y-1 text-xs mb-2 max-h-28 overflow-auto">
        {voiceCommands.map((c) => (
          <li key={c.id} className="flex justify-between items-center">
            <span>
              {c.phrase} {"->"} <span className="text-gold">{c.key.toUpperCase()}</span>
            </span>
            <button onClick={() => removeVoiceCommand(c.id)} className="text-red-400/60 text-[10px]">x</button>
          </li>
        ))}
      </ul>

      <div className="flex gap-1">
        <input
          value={newPhrase}
          onChange={(e) => setNewPhrase(e.target.value)}
          placeholder="phrase"
          className="flex-1 rounded bg-ink border border-elevated px-2 py-1 text-[10px]"
        />
        <input
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder="key"
          className="w-12 rounded bg-ink border border-elevated px-2 py-1 text-[10px]"
        />
        <button onClick={add} className="text-[10px] px-2 border border-elevated rounded">+</button>
      </div>
    </div>
  );
}