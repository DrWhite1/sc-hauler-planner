"use client";

import { useState, useRef, useEffect } from "react";
import { useHaulerStore } from "@/lib/store";
import { createModel } from "vosk-browser";

declare global {
  interface Window {
    electronAPI?: {
      sendKey: (payload: string | { key: string; duration?: number }) => void;
      captureScreenshot: () => Promise<string | null>;
    };
  }
}

type Status = "unavailable" | "idle" | "listening" | "error" | "loading";

const MODEL_URL = "https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip";

export function VoicePanel() {
  const { voiceCommands, addVoiceCommand, removeVoiceCommand } = useHaulerStore();
  const [status, setStatus] = useState<Status>("idle");
  const [statusMsg, setStatusMsg] = useState("Click Load model to start");
  const [model, setModel] = useState<any>(null);
  const [lastHeard, setLastHeard] = useState("");
  const [lastMatch, setLastMatch] = useState("");
  const [newPhrase, setNewPhrase] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newDuration, setNewDuration] = useState("");
  const recognizerRef = useRef<any>(null);
  const listeningRef = useRef(false);

  const loadModel = async () => {
    setStatus("loading");
    setStatusMsg("Loading model (~40 MB)...");
    try {
      const m = await createModel(MODEL_URL);
      setModel(m);
      setStatus("idle");
      setStatusMsg("Model ready - click Start");
    } catch (err) {
      setStatus("error");
      setStatusMsg("Failed to load model: " + String(err));
    }
  };

  const captureAndOCR = async () => {
    setStatusMsg("Capturing screenshot...");
    try {
      const b64 = await window.electronAPI?.captureScreenshot();
      if (!b64) {
        setStatusMsg("Screenshot failed");
        return;
      }
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: "image/png" });
      const file = new File([blob], "screenshot.png", { type: "image/png" });
      window.dispatchEvent(new CustomEvent("ocr-screenshot", { detail: file }));
      setStatusMsg("Screenshot sent to OCR");
    } catch (err) {
      setStatusMsg("Screenshot error: " + String(err));
    }
  };

  const start = async () => {
    if (!model) return;
    try {
      const rec = new model.KaldiRecognizer(16000);
      rec.on("result", (msg: any) => {
        const text = msg.result?.text || "";
        if (!text) return;
        setLastHeard(text);
        const lower = text.toLowerCase();
        if (lower.includes("screenshot")) {
          setLastMatch("screenshot -> OCR");
          setStatusMsg("Screenshot command");
          captureAndOCR();
          return;
        }
        const match = voiceCommands.find((c) => lower.includes(c.phrase.toLowerCase()));
        if (match) {
          setLastMatch(match.phrase + " -> " + match.key.toUpperCase());
          setStatusMsg("Matched: " + match.phrase);
          window.electronAPI?.sendKey({ key: match.key, duration: match.duration });
        }
      });
      rec.on("partialresult", (msg: any) => {
        const partial = msg.result?.partial || "";
        if (partial) setLastHeard(partial);
      });
      recognizerRef.current = rec;
      listeningRef.current = true;
      setStatus("listening");
      setStatusMsg("Listening... speak a command");

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext({ sampleRate: 16000 });
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (e) => {
        if (!listeningRef.current) return;
        rec.acceptWaveform(e.inputBuffer);
      };
      source.connect(processor);
      processor.connect(ctx.destination);
    } catch (err) {
      setStatus("error");
      setStatusMsg("Mic error: " + String(err));
    }
  };

  const stop = () => {
    listeningRef.current = false;
    recognizerRef.current?.remove();
    setStatus("idle");
    setStatusMsg("Stopped");
  };

  const toggle = () => (listeningRef.current ? stop() : start());

  const testKey = () => {
    setStatusMsg("Switch to game now - sending alt+n in 2s...");
    setTimeout(() => {
      window.electronAPI?.sendKey({ key: "alt+n", duration: 100 });
      setStatusMsg("Sent alt+n (100ms)");
    }, 2000);
  };

  const add = () => {
    if (!newPhrase.trim() || !newKey.trim()) return;
    const dur = parseInt(newDuration, 10);
    addVoiceCommand(newPhrase.trim().toLowerCase(), newKey.trim().toLowerCase(), dur > 0 ? dur : undefined);
    setNewPhrase("");
    setNewKey("");
    setNewDuration("");
  };

  const statusColor =
    status === "listening" ? "text-sage" :
    status === "error" ? "text-red-400" :
    status === "loading" ? "text-gold" : "text-accent/50";

  return (
    <div className="panel p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-medium uppercase tracking-wider text-accent/50">Voice</h3>
        <button
          onClick={toggle}
          disabled={!model || status === "loading"}
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
            status === "loading" ? "bg-gold" : "bg-accent/30"
          }`}
        />
        <span>{statusMsg}</span>
      </div>

      {!model && status !== "loading" && (
        <button onClick={loadModel} className="text-[10px] mb-2 text-gold hover:underline">
          Load model (~40 MB)
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
        Test alt+n 100ms (2s delay)
      </button>

      <ul className="space-y-1 text-xs mb-2 max-h-28 overflow-auto">
        {voiceCommands.map((c) => (
          <li key={c.id} className="flex justify-between items-center">
            <span>
              {c.phrase} {"->"} <span className="text-gold">{c.key.toUpperCase()}</span>
              {c.duration ? <span className="text-accent/40"> ({c.duration}ms)</span> : null}
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
          placeholder="alt+n"
          className="w-16 rounded bg-ink border border-elevated px-2 py-1 text-[10px]"
        />
        <input
          value={newDuration}
          onChange={(e) => setNewDuration(e.target.value)}
          placeholder="ms"
          className="w-10 rounded bg-ink border border-elevated px-2 py-1 text-[10px]"
        />
        <button onClick={add} className="text-[10px] px-2 border border-elevated rounded">+</button>
      </div>
      <p className="text-[9px] text-accent/30 mt-1">Say "screenshot" to OCR the screen. ms = hold time.</p>
    </div>
  );
}