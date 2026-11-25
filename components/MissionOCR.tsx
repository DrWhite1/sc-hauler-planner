"use client";

import { useState, useCallback, useEffect } from "react";
import { createWorker } from "tesseract.js";
import { useHaulerStore } from "@/lib/store";
import { parseContractText } from "@/lib/parseContract";

// Crop the right half of the screenshot (reward + objectives), upscale 2x, grayscale.
async function cropRightHalf(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const x0 = Math.floor(bmp.width * 0.45);
  const w = bmp.width - x0;
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = w * scale;
  canvas.height = bmp.height * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.filter = "grayscale(1) contrast(1.3)";
  ctx.drawImage(bmp, x0, 0, w, bmp.height, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png")
  );
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

      let text = data.text;
      let result = parseContractText(text);

      // Two-column contract screens often come out interleaved (story text mixed into
      // the objectives). If the first read is incomplete, re-read only the right-hand
      // half (rewards + objectives), upscaled and in grayscale, as one text block.
      if (!result.complete) {
        try {
          const crop = await cropRightHalf(file);
          await worker.setParameters({ tessedit_pageseg_mode: "6" as any });
          const second = await worker.recognize(crop);
          const result2 = parseContractText(second.data.text);
          const score = (r: typeof result) =>
            (r.complete ? 100 : 0) + r.delivers.length + r.collects.length + (r.reward ? 1 : 0);
          if (score(result2) >= score(result)) {
            result = result2;
            text = second.data.text;
          }
        } catch (cropErr) {
          console.warn("right-half OCR pass failed", cropErr);
        }
      }
      await worker.terminate();

      setExtracted(text);
      setParsed(result);

      if (result.reward && result.pickup && result.dropoff && result.complete) {
        addMission({
          pickup: result.pickup.slice(0, 120),
          dropoff: result.dropoff.slice(0, 120),
          reward: result.reward,
          scu: result.totalScu || 0,
          corporation: result.corporation || "Unknown",
          legs: result.legs.length > 0 ? result.legs : undefined,
          maxContainerSize: result.maxContainerSize,
        });
        const legNote = result.legs.length > 2 ? ` · ${result.legs.length} legs` : "";
        setStatus(`Added: ${result.totalScu || "?"} SCU · ${result.reward.toLocaleString()} aUEC${legNote}`);
      } else if (result.missingPickups.length > 0) {
        setStatus(
          `Read ${result.collects.length} of ${result.delivers.length} pickups (missing: ${result.missingPickups.join(", ")}). Not added. Re-crop the screenshot or add manually.`
        );
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
