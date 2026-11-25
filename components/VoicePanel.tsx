"use client";

import { useState, useRef, useEffect } from "react";
import { useHaulerStore } from "@/lib/store";

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    electronAPI?: { sendKey: (key: string) => void };
  }
}

type Status = "unavailable" | "idle" | "listening" | "error";

export function VoicePanel() {
  const { voiceCommands, addVoiceCommand, removeVoiceCommand } = useHaulerStore();
  const [status, setStatus] = useState<Status>("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [lastHeard, setLastHeard] = useState("");
  const [lastMatch, setLastMatch] = useState("");
  const [newPhrase, setNewPhrase] = useState("");
  const [newKey, setNewKey] = useState("");
  const recRef = useRef<any>(null);
  const listeningRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.webkitSpeechRecognition) {
      setStatus("unavailable");
      setStatusMsg("Speech recognition not supported in this build");
      return;
    }
    setStatus("idle");
    setStatusMsg("Ready - click Start and speak");

    const Rec = window.webkitSpeechRecognition;
    const rec = new Rec();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onstart = () => {
      setStatus("listening");
      setStatusMsg("Listening... speak a command");
    };

    rec.onresult = (e: any) => {
      const result = e.results[e.results.length - 1];
      const text = result[0].transcript.toLowerCase().trim();
      setLastHeard(text);
      if (!result.isFinal) return;

      const match = voiceCommands.find((c) => text.includes(c.phrase.toLowerCase()));
      if (match) {
        setLastMatch(match.phrase + " -> " + match.key.toUpperCase());
        setStatusMsg("Matched: " + match.phrase);
        if (window.electronAPI && window.electronAPI.sendKey) {
          window.electronAPI.sendKey(match.key);
        } else {
          setStatusMsg("Matched " + match.phrase + " but key sending not available");
        }
      } else {
        setStatusMsg("Heard: " + text + " - no match");
      }
    };

    rec.onerror = (e: any) => {
      setStatus("error");
      setStatusMsg("Error: " + (e.error || "unknown"));
      listeningRef.current = false;
    };

    rec.onend = () => {
      if (listeningRef.current) {
        try { rec.start(); } catch (e) {}
      } else {
        setStatus("idle");
        setStatusMsg("Stopped");
      }
    };

    recRef.current = rec;
    return () => {
      listeningRef.current = false;
      try { rec.stop(); } catch (e) {}
    };
  }, [voiceCommands]);

  const toggle = () => {
    if (!recRef.current) return;
    if (listeningRef.current) {
      listeningRef.current = false;
      try { recRef.current.stop(); } catch (e) {}
      setStatus("idle");
      setStatusMsg("Stopped");
    } else {
      listeningRef.current = true;
      try {
        recRef.current.start();
      } catch (err) {
        setStatus("error");
        setStatusMsg("Could not start recognition");
        listeningRef.current = false;
      }
    }
  };

  const testKey = () => {
    if (window.electronAPI && window.electronAPI.sendKey) {
      window.electronAPI.sendKey("t");
      setStatusMsg("Sent test key T - check the focused window");
    } else {
      setStatusMsg("Key sending not available - rebuild the desktop app");
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
    status === "unavailable" ? "text-red-400" : "text-accent/50";

  return (
    <div className="panel p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-medium uppercase tracking-wider text-accent/50">Voice</h3>
        <button
          onClick={toggle}
          disabled={status === "unavailable"}
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
            status === "error" || status === "unavailable" ? "bg-red-400" : "bg-accent/30"
          }`}
        />
        <span>{statusMsg || (status === "idle" ? "Idle" : status)}</span>
      </div>

      {lastHeard && (
        <p className="text-[10px] text-accent/50 mb-1">
          Heard: <span className="text-accent">{lastHeard}</span>
        </p>
      )}
      {lastMatch && (
        <p className="text-[10px] text-gold mb-2">Last match: {lastMatch}</p>
      )}

      <button
        onClick={testKey}
        className="text-[10px] mb-2 text-accent/50 hover:text-accent underline"
      >
        Test key send (T)
      </button>

      <ul className="space-y-1 text-xs mb-2 max-h-28 overflow-auto">
        {voiceCommands.map((c) => (
          <li key={c.id} className="flex justify-between items-center">
            <span>"{c.phrase}" -> <span className="text-gold">{c.key.toUpperCase()}</span></span>
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