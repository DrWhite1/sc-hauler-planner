"use client";

import { useState, useRef, useEffect } from "react";
import { useHaulerStore } from "@/lib/store";
import { createModel } from "vosk-browser";

declare global {
  interface Window {
    electronAPI?: { sendKey: (key: string) => void };
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

  const start = async () => {
    if (!model) return;
    try {
      const rec = new model.KaldiRecognizer(16000);
      rec.on("result", (msg: any) => {
        const text = msg.result?.text || "";
        if (!text) return;
        setLastHeard(text);
        const match = voiceCommands.find((c) => text.toLowerCase().includes(c.phrase.toLowerCase()));
        if (match) {
          setLastMatch(match.phrase + " -> " + match.key.toUpperCase());
          setStatusMsg("Matched: " + match.phrase);
          window.electronAPI?.sendKey(match.key);
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
    setStatusMsg("Switch to Notepad now - sending T in 2s...");
    setTimeout(() => {
      window.electronAPI?.sendKey("t");
      setStatusMsg("Sent T");
    }, 2000);
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
        Test key send (T) - 2s delay
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