"use client";

import { useState, useRef, useEffect } from "react";
import { useHaulerStore } from "@/lib/store";

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    electronAPI?: { sendKey: (key: string) => void };
  }
}

export function VoicePanel() {
  const { voiceCommands, addVoiceCommand, removeVoiceCommand } = useHaulerStore();
  const [listening, setListening] = useState(false);
  const [lastHeard, setLastHeard] = useState("");
  const [lastAction, setLastAction] = useState("");
  const [newPhrase, setNewPhrase] = useState("");
  const [newKey, setNewKey] = useState("");
  const recRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.webkitSpeechRecognition) return;
    const Rec = window.webkitSpeechRecognition;
    const rec = new Rec();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = "en-US";
    rec.onresult = (e: any) => {
      const text = e.results[e.results.length - 1][0].transcript.toLowerCase().trim();
      setLastHeard(text);
      const match = voiceCommands.find((c) => text.includes(c.phrase.toLowerCase()));
      if (match) {
        setLastAction(`${match.phrase} → ${match.key.toUpperCase()}`);
        window.electronAPI?.sendKey(match.key);
      }
    };
    rec.onend = () => {
      if (listening) rec.start();
    };
    recRef.current = rec;
    return () => rec.stop();
  }, [voiceCommands, listening]);

  const toggle = () => {
    if (!recRef.current) {
      setLastAction("Speech recognition not available");
      return;
    }
    if (listening) {
      recRef.current.stop();
      setListening(false);
    } else {
      recRef.current.start();
      setListening(true);
    }
  };

  const add = () => {
    if (!newPhrase.trim() || !newKey.trim()) return;
    addVoiceCommand(newPhrase.trim().toLowerCase(), newKey.trim().toLowerCase());
    setNewPhrase("");
    setNewKey("");
  };

  return (
    <div className="panel p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-medium uppercase tracking-wider text-accent/50">Voice</h3>
        <button
          onClick={toggle}
          className={`text-[10px] px-2 py-0.5 rounded ${listening ? "bg-sage text-ink" : "border border-elevated text-accent/60"}`}
        >
          {listening ? "Listening" : "Start"}
        </button>
      </div>

      {lastHeard && <p className="text-[10px] text-accent/40 mb-1">Heard: {lastHeard}</p>}
      {lastAction && <p className="text-[10px] text-gold mb-2">{lastAction}</p>}

      <ul className="space-y-1 text-xs mb-2 max-h-32 overflow-auto">
        {voiceCommands.map((c) => (
          <li key={c.id} className="flex justify-between items-center">
            <span>“{c.phrase}” → <span className="text-gold">{c.key.toUpperCase()}</span></span>
            <button onClick={() => removeVoiceCommand(c.id)} className="text-red-400/60 text-[10px]">×</button>
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