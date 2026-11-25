"use client";

import { useState, useCallback, useEffect } from "react";
import { createWorker } from "tesseract.js";
import { useHaulerStore, type Leg } from "@/lib/store";

const LOCATION_ALIASES: Record<string, string> = {
  tressler: "Port Tressler",
  ressler: "Port Tressler",
  goldenrod: "Sakura Sun Goldenrod Workcenter",
  "sakura sun": "Sakura Sun Goldenrod Workcenter",
  everus: "Everus Harbor",
  seraphim: "Seraphim Station",
  baijini: "Baijini Point",
  "brio": "Brio's Breaker Yard",
  "sacren": "Sacren's Plot",
  "modern icarus": "MIC-L5 Modern Icarus",
  "nb int": "NB Int. Spaceport",
  "spaceport": "NB Int. Spaceport",
};

function normalizeLocation(raw: string): string {
  const lower = raw.toLowerCase();
  for (const [key, val] of Object.entries(LOCATION_ALIASES)) {
    if (lower.includes(key)) return val;
  }
  return raw.trim();
}

function parseContractText(text: string) {
  const full = text.replace(/\s+/g, " ");

  // Reward
  let reward = 0;
  const rewardMatch = full.match(/reward[^\d]*([\d,]{4,})/i);
  if (rewardMatch) {
    const v = parseInt(rewardMatch[1].replace(/,/g, ""), 10);
    if (v >= 10000) reward = v;
  }
  if (!reward) {
    const nums = full.match(/[\d,]{5,}/g) || [];
    for (const n of nums) {
      const v = parseInt(n.replace(/,/g, ""), 10);
      if (v >= 20000 && v < 500000) reward = Math.max(reward, v);
    }
  }

  const collects: { commodity: string; location: string; scu: number }[] = [];
  const delivers: { commodity: string; location: string; scu: number }[] = [];

  // Loose collect: look for commodity + location fragments
  const collectLoose = full.match(/(?:collect|col|pick)\s+([a-z]+)\s+(?:from|at)?\s*([a-z'\s]+)/i);
  if (collectLoose) {
    const commodity = collectLoose[1].trim();
    const locRaw = collectLoose[2].trim();
    const location = normalizeLocation(locRaw);
    collects.push({ commodity, location, scu: 0 });
  }

  // Loose deliver: "0/6 SCU of X to Y"
  const deliverLoose = full.match(/(\d+)\/(\d+)\s*SCU\s+of\s+([a-z\s]+?)\s+to\s+([a-z'\s]+)/i);
  if (deliverLoose) {
    const scu = parseInt(deliverLoose[2], 10);
    const commodity = deliverLoose[3].trim();
    const locRaw = deliverLoose[4].trim();
    const location = normalizeLocation(locRaw);
    delivers.push({ commodity, location, scu });
  }

  // Fallback SCU
  if (delivers.length === 0) {
    const scuMatch = full.match(/(\d+)\s*SCU/i);
    const scu = scuMatch ? parseInt(scuMatch[1], 10) : 0;
    if (collects.length > 0) {
      delivers.push({ commodity: collects[0].commodity, location: "", scu });
    }
  }

  if (collects.length > 0 && delivers.length > 0 && collects[0].scu === 0) {
    const totalDeliver = delivers.reduce((s, d) => s + d.scu, 0);
    const perCollect = Math.round(totalDeliver / Math.max(1, collects.length));
    collects.forEach((c) => (c.scu = perCollect));
  }

  const totalScu = delivers.reduce((s, d) => s + d.scu, 0) || collects.reduce((s, c) => s + c.scu, 0);

  const pickupLocs = [...new Set(collects.map((c) => c.location).filter(Boolean))];
  const dropoffLocs = [...new Set(delivers.map((d) => d.location).filter(Boolean))];

  const pickup = pickupLocs.length ? pickupLocs.slice(0, 3).join(" + ") : "";
  const dropoff = dropoffLocs.length ? dropoffLocs.slice(0, 3).join(" + ") : "";

  const legs: Leg[] = [];
  for (const c of collects) {
    if (c.location) legs.push({ type: "pickup", location: c.location, scu: c.scu, commodity: c.commodity });
  }
  for (const d of delivers) {
    if (d.location) legs.push({ type: "dropoff", location: d.location, scu: d.scu, commodity: d.commodity });
  }

  return {
    reward,
    totalScu,
    pickup,
    dropoff,
    collects,
    delivers,
    legs,
    maxContainerSize: undefined,
    lines: text.split(/\n+/),
  };
}

export function MissionOCR() {
  const addMission = useHaulerStore((s) => s.addMission);
  const [status, setStatus] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ReturnType<typeof parseContractText> | null>(null);

  const processImage = useCallback(async (file: File) => {
    setStatus("Reading screenshot...");
    setExtracted(null);
    setParsed(null);
    const url = URL.createObjectURL(file);
    setPreview(url);

    try {
      const worker = await createWorker("eng");
      const { data } = await worker.recognize(file);
      await worker.terminate();

      const text = data.text;
      setExtracted(text);

      const result = parseContractText(text);
      setParsed(result);

      if (result.reward && result.pickup && result.dropoff) {
        addMission({
          pickup: result.pickup.slice(0, 100),
          dropoff: result.dropoff.slice(0, 100),
          reward: result.reward,
          scu: result.totalScu || 0,
          corporation: "Covalex",
          legs: result.legs.length > 0 ? result.legs : undefined,
          maxContainerSize: result.maxContainerSize,
        });
        const legNote = result.legs.length > 2 ? ` · ${result.legs.length} legs` : "";
        setStatus(`Added: ${result.totalScu || "?"} SCU · ${result.reward.toLocaleString()} aUEC${legNote}`);
      } else {
        setStatus("Partial data found — review below and add manually if needed");
      }
    } catch (err) {
      console.error(err);
      setStatus("OCR failed — try a clearer screenshot");
    }
  }, [addMission]);

  useEffect(() => {
    const handler = (e: Event) => {
      const file = (e as CustomEvent).detail as File;
      if (file) processImage(file);
    };
    window.addEventListener("ocr-screenshot", handler);
    return () => window.removeEventListener("ocr-screenshot", handler);
  }, [processImage]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) processImage(file);
    },
    [processImage]
  );

  const onPaste = useCallback(
    (e: React.ClipboardEvent) => {
      const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
      if (item) {
        const file = item.getAsFile();
        if (file) processImage(file);
      }
    },
    [processImage]
  );

  return (
    <div
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
      onPaste={onPaste}
      tabIndex={0}
      className="rounded-lg border border-dashed border-elevated bg-elevated/20 p-4 focus:border-gold outline-none"
    >
      <h3 className="mb-2 text-sm font-medium uppercase tracking-wider text-accent/60">
        Screenshot OCR
      </h3>
      <p className="text-xs text-accent/50 mb-3">
        Paste (Ctrl+V), drop, or say "screenshot". Crop to the objectives panel for best results.
      </p>

      <input
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) processImage(file);
        }}
        className="text-xs file:mr-2 file:rounded file:border-0 file:bg-elevated file:px-2 file:py-1 file:text-xs"
      />

      {status && <p className="mt-2 text-xs text-gold">{status}</p>}

      {preview && (
        <img src={preview} alt="preview" className="mt-3 max-h-32 rounded border border-elevated object-contain" />
      )}

      {parsed && (parsed.collects.length > 0 || parsed.delivers.length > 0) && (
        <div className="mt-3 text-xs space-y-1 text-accent/80">
          {parsed.collects.map((c, i) => (
            <div key={`c${i}`}>
              Collect {c.commodity} from {c.location}
            </div>
          ))}
          {parsed.delivers.map((d, i) => (
            <div key={`d${i}`}>
              Deliver {d.scu} SCU {d.commodity} to {d.location}
            </div>
          ))}
        </div>
      )}

      {extracted && (
        <pre className="mt-3 max-h-40 overflow-auto rounded bg-ink p-2 text-[10px] text-accent/70 whitespace-pre-wrap">
          {extracted}
        </pre>
      )}
    </div>
  );
}