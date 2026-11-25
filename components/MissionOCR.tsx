"use client";

import { useState, useCallback, useEffect } from "react";
import { createWorker } from "tesseract.js";
import { useHaulerStore, type Leg } from "@/lib/store";

function parseContractText(text: string) {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const full = text.replace(/\s+/g, " ");

  let reward = 0;
  const candidates: number[] = [];

  // Reward near "Reward" or "aUEC"
  for (const line of lines) {
    if (/reward|auec|aec/i.test(line)) {
      const nums = line.match(/[\d,]{4,}/g) || [];
      for (const n of nums) {
        const v = parseInt(n.replace(/,/g, ""), 10);
        if (v >= 10000) candidates.push(v);
      }
    }
  }

  // Fallback: any large number in the text
  if (candidates.length === 0) {
    const allNums = full.match(/[\d,]{5,}/g) || [];
    for (const n of allNums) {
      const v = parseInt(n.replace(/,/g, ""), 10);
      if (v >= 20000 && v < 500000) candidates.push(v);
    }
  }

  if (candidates.length > 0) {
    reward = Math.max(...candidates);
  }

  let maxContainerSize = 0;
  const containerMatch =
    full.match(/(\d+)\s*SCU\s+or\s+smaller/i) ||
    full.match(/containers?\s+(?:of\s+)?(\d+)\s*SCU/i) ||
    full.match(/at\s+most\s+(?:the\s+)?containers?\s+will\s+be\s+(\d+)\s*SCU/i) ||
    full.match(/(\d+)\s*SCU\s+in\s+size/i);
  if (containerMatch) {
    maxContainerSize = parseInt(containerMatch[1], 10);
  }

  const collects: { commodity: string; location: string; scu: number }[] = [];
  const delivers: { commodity: string; location: string; scu: number }[] = [];

  // Collect lines
  for (const line of lines) {
    const collect = line.match(/Collect\s+(\w+)\s+from\s+(.+?)(?:\.|$)/i);
    if (collect) {
      collects.push({ commodity: collect[1], location: collect[2].trim(), scu: 0 });
    }
  }

  // Deliver lines (strict)
  for (const line of lines) {
    const deliver = line.match(/Deliver\s+([\d.]+)\/?([\d.]+)?\s*SCU\s+of\s+(\w+)\s+to\s+(.+?)(?:\.|$)/i);
    if (deliver) {
      const scu = parseFloat(deliver[2] || deliver[1]);
      delivers.push({
        commodity: deliver[3],
        location: deliver[4].trim(),
        scu,
      });
    }
  }

  // Fallback: look for "to <location>" near commodity or "freight elevator at <location>"
  if (delivers.length === 0) {
    const toMatch = full.match(/(?:to|at)\s+(Sakura Sun [^.,]{5,40}|[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4}\s+(?:Workcenter|Station|Hub|Depot|Center|Point|Harbor))/i);
    if (toMatch) {
      const loc = toMatch[1].trim();
      const commodity = collects[0]?.commodity || "Cargo";
      // Try to find SCU near the text
      const scuMatch = full.match(/(\d+)\s*SCU/i);
      const scu = scuMatch ? parseInt(scuMatch[1], 10) : 0;
      delivers.push({ commodity, location: loc, scu });
    }
  }

  // Another fallback: "delivering it to ... at <location>"
  if (delivers.length === 0) {
    const delivMatch = full.match(/delivering\s+it\s+to\s+.+?at\s+([A-Z][^.,]{5,40})/i);
    if (delivMatch) {
      const commodity = collects[0]?.commodity || "Cargo";
      delivers.push({ commodity, location: delivMatch[1].trim(), scu: 0 });
    }
  }

  const totalScu = delivers.reduce((s, d) => s + d.scu, 0) || 0;

  const pickupLocs = [...new Set(collects.map((c) => c.location))];
  const dropoffLocs = [...new Set(delivers.map((d) => d.location))];

  const pickup = pickupLocs.length ? pickupLocs.slice(0, 2).join(" + ") : "";
  const dropoff = dropoffLocs.length ? dropoffLocs.join(" + ") : "";

  const legs: Leg[] = [];
  for (const c of collects) {
    legs.push({ type: "pickup", location: c.location, scu: c.scu || Math.round(totalScu / Math.max(1, collects.length)), commodity: c.commodity });
  }
  for (const d of delivers) {
    legs.push({ type: "dropoff", location: d.location, scu: d.scu, commodity: d.commodity });
  }

  return {
    reward,
    totalScu: Math.round(totalScu),
    pickup,
    dropoff,
    collects,
    delivers,
    legs,
    maxContainerSize: maxContainerSize || undefined,
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
        const sizeNote = result.maxContainerSize ? ` · ${result.maxContainerSize} SCU boxes` : "";
        setStatus(`Added: ${result.totalScu || "?"} SCU · ${result.reward.toLocaleString()} aUEC${result.legs.length > 2 ? ` · ${result.legs.length} legs` : ""}${sizeNote}`);
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
          {parsed.maxContainerSize && (
            <div className="text-gold">Max container: {parsed.maxContainerSize} SCU</div>
          )}
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