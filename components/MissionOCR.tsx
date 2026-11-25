"use client";

import { useState, useCallback, useEffect } from "react";
import { createWorker } from "tesseract.js";
import { useHaulerStore, type Leg } from "@/lib/store";
import { LOCATIONS } from "@/lib/locations";

const KNOWN_COMMODITIES = ["Quartz", "Waste", "Scrap", "Hydrogen", "Agricium", "Laranite", "Beryl", "Diamond", "Gold", "Copper", "Iron", "Titanium", "Tungsten", "Medical", "Food", "Stims"];

function findLocationInText(text: string): string | null {
  const lower = text.toLowerCase();
  for (const loc of LOCATIONS) {
    const name = loc.name.toLowerCase();
    if (lower.includes(name)) return loc.name;
    // Fuzzy: check if most words match
    const words = name.split(/\s+/).filter((w) => w.length > 3);
    if (words.length > 0 && words.every((w) => lower.includes(w))) return loc.name;
  }
  // Special cases for common OCR errors
  if (/sakura\s*sun/i.test(text)) return "Sakura Sun Goldenrod Workcenter";
  if (/goldenrod/i.test(text)) return "Sakura Sun Goldenrod Workcenter";
  if (/port\s*tress/i.test(text) || /tressler/i.test(text)) return "Port Tressler";
  if (/everus/i.test(text)) return "Everus Harbor";
  if (/seraphim/i.test(text)) return "Seraphim Station";
  if (/baijini/i.test(text)) return "Baijini Point";
  return null;
}

function parseContractText(text: string) {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
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
      if (v >= 20000 && v < 500000) {
        reward = Math.max(reward, v);
      }
    }
  }

  // SCU from "0/6 SCU" or "6 SCU"
  let totalScu = 0;
  const scuMatch = full.match(/(\d+)\/(\d+)\s*SCU/i) || full.match(/(\d+)\s*SCU/i);
  if (scuMatch) {
    totalScu = parseInt(scuMatch[2] || scuMatch[1], 10);
  }

  // Commodity
  let commodity = "Cargo";
  for (const c of KNOWN_COMMODITIES) {
    if (full.toLowerCase().includes(c.toLowerCase())) {
      commodity = c;
      break;
    }
  }

  // Locations
  const pickupLoc = findLocationInText(full);
  let dropoffLoc: string | null = null;

  // Look for delivery location specifically
  const deliverLine = full.match(/deliver[^.]{0,80}/i);
  if (deliverLine) {
    dropoffLoc = findLocationInText(deliverLine[0]);
  }
  if (!dropoffLoc) {
    dropoffLoc = findLocationInText(full);
    if (dropoffLoc === pickupLoc) dropoffLoc = null;
  }

  // If we found one location, try to find another
  if (pickupLoc && !dropoffLoc) {
    const afterPickup = full.split(new RegExp(pickupLoc, "i"))[1] || "";
    dropoffLoc = findLocationInText(afterPickup);
  }

  const collects: { commodity: string; location: string; scu: number }[] = [];
  const delivers: { commodity: string; location: string; scu: number }[] = [];

  if (pickupLoc) {
    collects.push({ commodity, location: pickupLoc, scu: totalScu });
  }
  if (dropoffLoc) {
    delivers.push({ commodity, location: dropoffLoc, scu: totalScu });
  }

  const pickup = pickupLoc || "";
  const dropoff = dropoffLoc || "";

  const legs: Leg[] = [];
  if (pickupLoc) legs.push({ type: "pickup", location: pickupLoc, scu: totalScu, commodity });
  if (dropoffLoc) legs.push({ type: "dropoff", location: dropoffLoc, scu: totalScu, commodity });

  return {
    reward,
    totalScu,
    pickup,
    dropoff,
    collects,
    delivers,
    legs,
    maxContainerSize: undefined,
    lines,
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
          pickup: result.pickup.slice(0, 80),
          dropoff: result.dropoff.slice(0, 80),
          reward: result.reward,
          scu: result.totalScu || 0,
          corporation: "Covalex",
          legs: result.legs.length > 0 ? result.legs : undefined,
          maxContainerSize: result.maxContainerSize,
        });
        setStatus(`Added: ${result.totalScu || "?"} SCU · ${result.reward.toLocaleString()} aUEC`);
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
        Paste (Ctrl+V), drop, or say "screenshot"
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