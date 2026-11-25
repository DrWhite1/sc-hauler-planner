"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useHaulerStore } from "@/lib/store";
import { planRoute } from "@/lib/optimizer";
import { buildPackingOrder } from "@/lib/packing";
import { boxBreakdown } from "@/lib/containers";
import { fillHold, fitLayout, actualLayout, cellAt, type HoldItem, type GridLayout } from "@/lib/packer";

const COLORS = ["#4a9d7a", "#d4a84b", "#5b8fc7", "#c47a7a", "#8b7ab8", "#6ab09a"];
const EMPTY = "#12161c";
const ACTUAL_CELL = 14;

// Width of the panel (re-measured on resize) and a height budget based on the window.
function usePanelSize() {
  // Callback ref: the panel only exists once a ship is selected, so re-attach when it appears.
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const [viewportH, setViewportH] = useState(800);

  useEffect(() => {
    if (!el) return;
    const measure = () => setWidth(Math.floor(el.clientWidth));
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    const onWin = () => {
      setViewportH(window.innerHeight);
      measure();
    };
    onWin();
    window.addEventListener("resize", onWin);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", onWin);
    };
  }, [el]);

  const maxHeight = Math.round(Math.min(900, Math.max(180, viewportH * 0.6)));
  return { ref: setEl, width, maxHeight };
}

export function CargoGrid() {
  const { missions, selectedShip, currentLocation, completedStops, gridFit, setGridFit } = useHaulerStore();
  const { ref: panelRef, width, maxHeight } = usePanelSize();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<string>("");

  const route = useMemo(
    () =>
      missions.length > 0 && selectedShip
        ? planRoute(missions, selectedShip, currentLocation)
        : null,
    [missions, selectedShip, currentLocation]
  );

  // What is on board right now: checked pickups minus checked deliveries, per pickup leg.
  const hold = useMemo(() => {
    if (!selectedShip) return null;
    const items: HoldItem[] = [];
    if (route) {
      const packing = buildPackingOrder(route.stops, missions, selectedShip.maxContainer);
      const legs = packing
        .filter((p) => completedStops.includes(`${p.missionId}:pickup:${p.location}`))
        .map((p) => ({ ...p, onBoard: p.scu }));

      for (const stop of route.stops) {
        if (stop.type !== "dropoff") continue;
        if (!completedStops.includes(`${stop.missionId}:dropoff:${stop.location}`)) continue;
        let left = stop.scu;
        const mine = legs.filter((l) => l.missionId === stop.missionId);
        const sameCommodity = mine.filter((l) => stop.commodity && l.commodity === stop.commodity);
        for (const l of [...sameCommodity, ...mine.filter((x) => !sameCommodity.includes(x))]) {
          const take = Math.min(l.onBoard, left);
          l.onBoard -= take;
          left -= take;
          if (left <= 0) break;
        }
      }

      for (const l of legs) {
        if (l.onBoard <= 0) continue;
        const m = missions.find((x) => x.id === l.missionId);
        items.push({
          missionId: l.missionId,
          deliverOrder: l.deliverOrder,
          boxes: boxBreakdown(l.onBoard, l.containerSize),
          label: `${l.commodity || "Cargo"} · ${m ? `${m.pickup} → ${m.dropoff}` : "Mission"}`,
        });
      }
    }
    return fillHold(items, selectedShip.scu);
  }, [route, missions, selectedShip, completedStops]);

  const layout: GridLayout | null = useMemo(() => {
    if (!selectedShip || width <= 0) return null;
    const usable = Math.max(40, width - 8); // room for the door marker
    return gridFit
      ? fitLayout(selectedShip.scu, usable, maxHeight)
      : actualLayout(selectedShip.scu, usable, ACTUAL_CELL);
  }, [selectedShip, width, maxHeight, gridFit]);

  const missionColors = useMemo(() => {
    const map = new Map<string, string>();
    let i = 0;
    for (const c of hold?.cells || []) {
      if (c && !map.has(c.missionId)) map.set(c.missionId, COLORS[i++ % COLORS.length]);
    }
    return map;
  }, [hold]);

  // Draw on a canvas: thousands of cells (Hull C 4,608, Hull E 12,288) stay fast.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !layout || !hold) return;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    canvas.width = Math.ceil(layout.width * dpr);
    canvas.height = Math.ceil(layout.height * dpr);
    canvas.style.width = `${layout.width}px`;
    canvas.style.height = `${layout.height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, layout.width, layout.height);

    const c = layout.cell;
    const gap = c >= 6 ? 1 : c >= 3 ? 0.5 : 0;
    const n = hold.cells.length;
    for (let i = 0; i < n; i++) {
      const col = Math.floor(i / layout.rows);
      const row = i % layout.rows;
      const cell = hold.cells[i];
      if (cell) {
        ctx.fillStyle = missionColors.get(cell.missionId) || COLORS[0];
        // Alternate shade per box so neighbouring boxes of one mission stay distinguishable.
        ctx.globalAlpha = cell.boxIndex % 2 === 0 ? 0.95 : 0.7;
      } else {
        ctx.fillStyle = EMPTY;
        ctx.globalAlpha = 1;
      }
      ctx.fillRect(col * c + gap / 2, row * c + gap / 2, c - gap, c - gap);
    }
    ctx.globalAlpha = 1;
  }, [layout, hold, missionColors]);

  if (!selectedShip) return null;

  const onBoardScu = hold?.used ?? 0;
  const capacity = selectedShip.scu;

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!layout || !hold) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const idx = cellAt(e.clientX - rect.left, e.clientY - rect.top, layout, hold.cells.length);
    if (idx === null) return setHover("");
    const cell = hold.cells[idx];
    setHover(cell ? `SCU ${idx + 1}: ${cell.boxSize} SCU box · ${cell.label ?? ""}` : `SCU ${idx + 1}: empty`);
  };

  return (
    <div className="rounded-lg border border-elevated bg-elevated/40 p-4 mt-4">
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <h3 className="text-xs font-medium uppercase tracking-wider text-accent/50 truncate">
          Cargo Grid — {selectedShip.name}
        </h3>
        <span className="text-[10px] text-accent/40 whitespace-nowrap tabular-nums">
          {onBoardScu.toLocaleString()} / {capacity.toLocaleString()} SCU
        </span>
      </div>

      <div className="flex items-center justify-between mb-2 text-[10px]">
        <div className="inline-flex rounded border border-elevated overflow-hidden" role="group" aria-label="Grid size">
          <button
            type="button"
            onClick={() => setGridFit(true)}
            className={`px-2 py-0.5 ${gridFit ? "bg-gold/80 text-ink" : "text-accent/50 hover:text-accent"}`}
            aria-pressed={gridFit}
          >
            Fit to window
          </button>
          <button
            type="button"
            onClick={() => setGridFit(false)}
            className={`px-2 py-0.5 ${!gridFit ? "bg-gold/80 text-ink" : "text-accent/50 hover:text-accent"}`}
            aria-pressed={!gridFit}
          >
            Actual size
          </button>
        </div>
        <span className="text-accent/30">1 square = 1 SCU · door →</span>
      </div>

      <div ref={panelRef} className="w-full">
        <div
          className={gridFit ? "" : "overflow-auto"}
          style={gridFit ? undefined : { maxHeight }}
        >
          <div className="relative inline-block pr-2">
            <canvas
              ref={canvasRef}
              onMouseMove={onMove}
              onMouseLeave={() => setHover("")}
              title={hover}
              className="block bg-ink rounded-sm"
              aria-label={`Cargo grid, ${capacity} SCU, ${onBoardScu} SCU loaded`}
            />
            {/* Door indicator on the right */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gold/60 rounded-sm" title="Door" />
          </div>
        </div>
      </div>

      {hold && hold.overflow > 0 && (
        <p className="mt-2 text-[10px] text-red-400">
          {hold.overflow} SCU does not fit in the {capacity} SCU hold.
        </p>
      )}

      {missionColors.size > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
          {Array.from(missionColors.entries()).map(([id, color]) => {
            const m = missions.find((x) => x.id === id);
            const scu = hold?.cells.filter((c) => c?.missionId === id).length ?? 0;
            return (
              <span key={id} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
                <span className="text-accent/70">{m?.pickup.slice(0, 24) || "Mission"}</span>
                <span className="text-accent/40 tabular-nums">{scu} SCU</span>
              </span>
            );
          })}
        </div>
      )}

      {route && onBoardScu === 0 && (
        <p className="text-[10px] text-accent/40 mt-2">Check off pickups to load the grid.</p>
      )}
    </div>
  );
}
