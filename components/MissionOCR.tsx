"use client";

import { useState, useCallback } from "react";
import { createWorker } from "tesseract.js";
import { useHaulerStore } from "@/lib/store";

export function MissionOCR() {
  const addMission = useHaulerStore((s) => s.addMission);
  const [status, setStatus] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<string | null>(null);

  const processImage = useCallback(async (file: File) => {
    setStatus("Reading screenshot...");
    setExtracted(null);
    const url = URL.createObjectURL(file);
    setPreview(url);

    try {
      const worker = await createWorker("eng");
      const { data } = await worker.recognize(file);
      await worker.terminate();

      const text = data.text;
      setExtracted(text);
      setStatus("OCR complete — review and add below");

      // Very basic heuristic parsing for common SC contract patterns
      const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
      let pickup = "";
      let dropoff = "";
      let reward = 0;
      let scu = 0;

      for (const line of lines) {
        const lower = line.toLowerCase();
        if (lower.includes("aec") || lower.includes("auec")) {
          const match = line.match(/[\d,]+/);
          if (match) reward = parseInt(match[0].replace(/,/g, ""), 10);
        }
        if (lower.includes("scu")) {
          const match = line.match(/[\d.]+/);
          if (match) scu = parseFloat(match[0]);
        }
        if (lower.includes("pickup") || lower.includes("collect") || lower.includes("from")) {
          pickup = line.replace(/pickup|collect|from/gi, "").trim();
        }
        if (lower.includes("deliver") || lower.includes("to") || lower.includes("drop")) {
          dropoff = line.replace(/deliver|drop|to/gi, "").trim();
        }
      }

      // Fallback: try to find two location-like lines
      if (!pickup || !dropoff) {
        const locationLike = lines.filter((l) => l.length > 5 && l.length < 40 && /[A-Z]/.test(l));
        if (locationLike.length >= 2) {
          pickup = pickup || locationLike[0];
          dropoff = dropoff || locationLike[1];
        }
      }

      if (pickup && dropoff && reward && scu) {
        addMission({
          pickup: pickup.slice(0, 60),
          dropoff: dropoff.slice(0, 60),
          reward,
          scu: Math.round(scu),
          corporation: "Covalex",
        });
        setStatus("Mission added from OCR ✓");
      } else {
        setStatus("Partial data found — check extracted text and add manually");
      }
    } catch (err) {
      console.error(err);
      setStatus("OCR failed — try a clearer screenshot");
    }
  }, [addMission]);

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
        Paste (Ctrl+V) or drop a contract screenshot
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

      {extracted && (
        <pre className="mt-3 max-h-40 overflow-auto rounded bg-ink p-2 text-[10px] text-accent/70 whitespace-pre-wrap">
          {extracted}
        </pre>
      )}
    </div>
  );
}