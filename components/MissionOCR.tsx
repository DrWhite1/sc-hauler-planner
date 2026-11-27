"use client";

import { useState, useCallback, useEffect } from "react";
import { createWorker } from "tesseract.js";
import { useHaulerStore } from "@/lib/store";
import { LOCATIONS, systemOf } from "@/lib/locations";
import {
  parseContractText,
  applySuggestedPickups,
  onlyPlacesMissing,
  legsWithUnplaced,
  scoreParse,
  pickConsensus,
  mergeReads,
  type ParsedContract,
} from "@/lib/parseContract";

const KNOWN_LOCATIONS = LOCATIONS.map((l) => l.name);
const PARSE_OPTS = { systemOf };

type LocalOcrApi = {
  ocrContract?: (
    bytes: Uint8Array
  ) => Promise<{ ok: boolean; header?: string; objectives?: string; error?: string; scanId?: string }>;
  // Appends a timing line to <userData>/ocr.log in the desktop app.
  ocrLog?: (entry: Record<string, unknown>) => void;
};

type Region = { x0: number; y0: number; x1: number; y1: number };
type OcrWord = { text: string; bbox: Region };

// Crop a region of the screenshot, upscale it and make it grayscale for OCR.
async function cropRegion(file: File, region: Region, scale: number): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const x0 = Math.max(0, Math.floor(region.x0));
  const y0 = Math.max(0, Math.floor(region.y0));
  const w = Math.min(bmp.width, Math.ceil(region.x1)) - x0;
  const h = Math.min(bmp.height, Math.ceil(region.y1)) - y0;
  const canvas = document.createElement("canvas");
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.filter = "grayscale(1) contrast(1.3)";
  ctx.drawImage(bmp, x0, y0, w, h, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png")
  );
}

// Find the "PRIMARY OBJECTIVES" heading in the first OCR pass and return the objectives
// column: from the heading to the right edge, down to just above "ACCEPT OFFER".
// Works for both layouts (objectives column at ~50% or ~64% of the width).
function findObjectivesRegion(words: OcrWord[], width: number, height: number): Region | null {
  const norm = (t: string) => t.replace(/[^a-z]/gi, "").toLowerCase();
  const primary = words.find((w) => norm(w.text) === "primary");
  const objectives = words.find((w) => norm(w.text) === "objectives");
  const anchor = primary ?? objectives;
  if (!anchor) return null;
  const heading = objectives ?? anchor;
  const accept = words.find((w) => norm(w.text) === "accept" && w.bbox.y0 > heading.bbox.y1);
  return {
    x0: anchor.bbox.x0 - width * 0.015,
    y0: heading.bbox.y0 - height * 0.03,
    x1: width,
    y1: accept ? accept.bbox.y0 : height * 0.9,
  };
}

export function MissionOCR() {
  const addMission = useHaulerStore((s) => s.addMission);
  const [status, setStatus] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedContract | null>(null);

  const addFromResult = useCallback(
    (result: ParsedContract) => {
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
      const note = result.notes.length ? ` · ${result.notes.join("; ")}` : "";
      setStatus(`Added: ${result.totalScu || "?"} SCU · ${result.reward.toLocaleString()} aUEC${legNote}${note}`);
    },
    [addMission]
  );

  const processImage = useCallback(async (file: File) => {
    setStatus("Reading screenshot...");
    setExtracted(null);
    setParsed(null);
    const url = URL.createObjectURL(file);
    setPreview(url);

    try {
      // Preferred engine: local PaddleOCR in the desktop app (much better on the game font).
      // If it is unavailable or its read is not complete, fall back to tesseract.js below.
      const api = (window as unknown as { electronAPI?: LocalOcrApi }).electronAPI;
      const scanStart = performance.now();
      const ms = (t: number) => Math.round(performance.now() - t);
      let scanId = `r${Date.now().toString(36)}`;
      const log = (event: string, fields: Record<string, unknown> = {}) => {
        try {
          api?.ocrLog?.({ scanId, event, ...fields });
        } catch {}
      };
      let localNote = "";
      let fallbackReason = "no local OCR";
      if (api?.ocrContract) {
        try {
          setStatus("Reading screenshot (local OCR)...");
          const res = await api.ocrContract(new Uint8Array(await file.arrayBuffer()));
          if (res.scanId) scanId = res.scanId;
          fallbackReason = res.ok ? "local read incomplete" : `local OCR failed: ${res.error ?? "unknown"}`;
          if (res.ok && res.objectives) {
            const localText = `${res.header ?? ""}\n${res.objectives}`;
            const local = parseContractText(localText, KNOWN_LOCATIONS, PARSE_OPTS);
            setExtracted(localText);
            setParsed(local);
            if (local.complete && local.reward) {
              addFromResult(local);
              log("local-accepted", { roundTripMs: ms(scanStart) });
              return;
            }
            localNote = local.complete ? "reward not found" : local.warnings.join("; ");
          }
        } catch (localErr) {
          console.warn("local OCR failed, using tesseract", localErr);
          fallbackReason = `local OCR threw: ${String(localErr)}`;
        }
        setStatus("Local OCR was not conclusive, trying a second engine...");
      }

      const localMs = ms(scanStart);
      log("fallback-start", { reason: fallbackReason.slice(0, 200), localMs });
      const tessStart = performance.now();
      const tessPasses: { scale: number; psm: string; ms: number }[] = [];
      let t = performance.now();
      const worker = await createWorker("eng");
      const initMs = ms(t);
      t = performance.now();
      const { data } = await worker.recognize(file);
      const firstReadMs = ms(t);
      let headerMs = 0;

      let text = data.text;
      let result = parseContractText(text, KNOWN_LOCATIONS, PARSE_OPTS);
      const reads: ParsedContract[] = [];

      // Contract screens come out interleaved (list, story text and objectives mixed) when read
      // whole, and a single read can mis-read a digit. Re-read the objectives column and only
      // trust a result that two reads agree on.
      {
        try {
          const bmp = await createImageBitmap(file);
          const width = bmp.width;
          const height = bmp.height;
          bmp.close();
          const words = ((data as unknown as { words?: OcrWord[] }).words ?? []) as OcrWord[];
          const region: Region = findObjectivesRegion(words, width, height) ?? {
            x0: width * 0.5,
            y0: 0,
            x1: width,
            y1: height * 0.9,
          };
          const passes: { scale: number; psm: string }[] = [
            { scale: 3, psm: "4" },
            { scale: 2, psm: "6" },
            { scale: 2, psm: "4" },
            { scale: 3, psm: "6" },
            { scale: 4, psm: "4" },
            { scale: 4, psm: "6" },
            { scale: 2, psm: "3" },
          ];
          reads.push(result);
          for (const pass of passes) {
            const passStart = performance.now();
            const crop = await cropRegion(file, region, pass.scale);
            await worker.setParameters({ tessedit_pageseg_mode: pass.psm as any });
            const second = await worker.recognize(crop);
            const next = parseContractText(second.data.text, KNOWN_LOCATIONS, PARSE_OPTS);
            // Reward, corporation and the DETAILS pickup hint sit outside the objectives crop.
            if (!next.reward) next.reward = result.reward;
            if (!next.corporation) next.corporation = result.corporation;
            if (!next.suggestedPickup) next.suggestedPickup = result.suggestedPickup;
            reads.push(next);
            tessPasses.push({ scale: pass.scale, psm: pass.psm, ms: ms(passStart) });
            if (scoreParse(next) > scoreParse(result)) {
              result = next;
              text = second.data.text;
            }
            // Stop as soon as two complete reads agree on every quantity and location.
            if (pickConsensus(reads).state === "agreed") break;
          }
          // Reward and corporation sit in the header box above the objectives, outside the crop.
          const headerStart = performance.now();
          try {
            const header: Region = {
              x0: Math.max(0, region.x0),
              y0: 0,
              x1: width,
              y1: Math.max(region.y0 + 4, 40),
            };
            const hCrop = await cropRegion(file, header, 3);
            await worker.setParameters({ tessedit_pageseg_mode: "6" as any });
            const h = parseContractText((await worker.recognize(hCrop)).data.text, KNOWN_LOCATIONS, PARSE_OPTS);
            if (h.reward || h.corporation) {
              for (const r of reads) {
                if (h.reward) r.reward = h.reward;
                if (h.corporation) r.corporation = h.corporation;
              }
            }
          } catch (hdrErr) {
            console.warn("header OCR pass failed", hdrErr);
          }
          headerMs = ms(headerStart);
        } catch (cropErr) {
          console.warn("objectives-column OCR pass failed", cropErr);
        }
      }
      await worker.terminate();
      log("tesseract-done", {
        tesseractMs: ms(tessStart),
        initMs,
        firstReadMs,
        passes: tessPasses,
        headerMs,
        scanMs: ms(scanStart),
      });

      setExtracted(text);
      setParsed(result);

      // A complete first read that needed no crop pass still counts as one read.
      if (reads.length === 0) reads.push(result);
      let consensus = pickConsensus(reads);
      // No single pass was clean: vote per objective across all passes.
      if (consensus.state !== "agreed" && consensus.state !== "single") {
        const merged = mergeReads(reads);
        if (merged.chosen && merged.chosen.complete) {
          consensus = { chosen: merged.chosen, state: "agreed", detail: "" };
        } else if (merged.detail) {
          consensus = { chosen: null, state: "conflict", detail: merged.detail };
        }
      }
      if (consensus.chosen) {
        result = consensus.chosen;
        setParsed(result);
      }

      if (consensus.state === "conflict") {
        setStatus(`Not added: OCR reads disagree (${consensus.detail}). Try a sharper screenshot or add manually.`);
      } else if (result.complete && !result.reward) {
        setStatus("Objectives read, but the reward was not found. Not added; add it manually.");
      } else if (result.complete) {
        addFromResult(result);
      } else {
        setStatus(`Not added: ${result.warnings.join("; ") || localNote || "nothing readable found"}`);
      }
    } catch (err) {
      console.error(err);
      setStatus("OCR failed — try a clearer screenshot");
    }
  }, [addFromResult]);

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

      {parsed && !parsed.complete && parsed.suggestedPickup && parsed.missingPickups.length > 0 && (
        <button
          onClick={() => {
            const applied = applySuggestedPickups(parsed);
            setParsed(applied);
            if (applied.complete && applied.reward) addFromResult(applied);
            else setStatus(`Still not complete: ${applied.warnings.join("; ")}`);
          }}
          className="mt-2 rounded border border-gold/40 px-2 py-1 text-[11px] text-gold hover:bg-gold/10"
        >
          Use {parsed.suggestedPickup} as pickup for {parsed.missingPickups.join(", ")} and add
        </button>
      )}

      {parsed && onlyPlacesMissing(parsed) && (
        <button
          onClick={() => {
            const legs = legsWithUnplaced(parsed);
            addFromResult({ ...parsed, legs });
            setStatus(
              `Added with ${legs.filter((l) => !l.location).length} place(s) missing: open the mission (Edit) and choose them from the list.`
            );
          }}
          className="mt-2 ml-2 rounded border border-gold/40 px-2 py-1 text-[11px] text-gold hover:bg-gold/10"
        >
          Add anyway and choose the missing place in Edit
        </button>
      )}

      {preview && (
        <img src={preview} alt="preview" className="mt-3 max-h-32 rounded border border-elevated object-contain" />
      )}

      {parsed && (parsed.collects.length > 0 || parsed.delivers.length > 0) && (
        <div className="mt-3 text-xs space-y-1 text-accent/80">
          {parsed.collects.map((c, i) => (
            <div key={`c${i}`}>
              Collect {c.scuEstimated ? "≈" : ""}{c.scu || "?"} SCU {c.commodity} from {c.location || "(place not read)"}
            </div>
          ))}
          {parsed.delivers.map((d, i) => (
            <div key={`d${i}`}>
              Deliver {d.scu} SCU {d.commodity} to {d.location}
            </div>
          ))}
          <div className="text-accent/50">
            Max container:{" "}
            {parsed.maxContainerSize ? `${parsed.maxContainerSize} SCU` : "not found (set it in Edit, else the ship max is used)"}
          </div>
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
