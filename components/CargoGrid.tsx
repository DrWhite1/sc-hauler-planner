"use client";

import { useMemo } from "react";
import { useHaulerStore } from "@/lib/store";
import { planRoute } from "@/lib/optimizer";
import { buildPackingOrder } from "@/lib/packing";
import { getGrid } from "@/lib/grids";
import { packGrid } from "@/lib/packer";

const COLORS = ["#4a9d7a", "#d4a84b", "#5b8fc7", "#c47a7a", "#8b7ab8", "#6ab09a"];

export function CargoGrid() {
  const { missions, selectedShip, currentLocation, completedStops } = useHaulerStore();

  const route = useMemo(
    () =>
      missions.length > 0 && selectedShip
        ? planRoute(missions, selectedShip, currentLocation)
        : null,
    [missions, selectedShip, currentLocation]
  );

  const placed = useMemo(() => {
    if (!route || !selectedShip) return [];

    const loadedPickups = new Set<string>();
    const deliveredMissions = new Set<string>();

    for (const stop of route.stops) {
      const key = `${stop.missionId}:${stop.type}:${stop.location}`;
      if (stop.type === "pickup" && completedStops.includes(key)) {
        loadedPickups.add(`${stop.missionId}:${stop.location}`);
      }
      if (stop.type === "dropoff" && completedStops.includes(key)) {
        deliveredMissions.add(stop.missionId);
      }
    }

    const packing = buildPackingOrder(route.stops, missions, selectedShip.maxContainer);
    const loaded = packing.filter(
      (p) =>
        loadedPickups.has(`${p.missionId}:${p.location}`) &&
        !deliveredMissions.has(p.missionId)
    );

    if (loaded.length === 0) return [];

    const grid = getGrid(selectedShip.id);
    return packGrid(loaded, grid);
  }, [route, missions, selectedShip, completedStops]);

  if (!selectedShip || !route) return null;

  const grid = getGrid(selectedShip.id);
  const cell = 22;
  const width = grid.cols * cell;
  const height = grid.rows * cell;

  const missionColors = new Map<string, string>();
  let colorIdx = 0;
  for (const p of placed) {
    if (!missionColors.has(p.item.missionId)) {
      missionColors.set(p.item.missionId, COLORS[colorIdx % COLORS.length]);
      colorIdx++;
    }
  }

  const onBoardScu = placed.reduce((sum, p) => sum + p.item.scu, 0);

  return (
    <div className="rounded-lg border border-elevated bg-elevated/40 p-4 mt-4">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-accent/50">
          Cargo Grid — {selectedShip.name}
        </h3>
        <span className="text-[10px] text-accent/40">{onBoardScu} SCU on board</span>
      </div>

      <div className="overflow-auto">
        <div className="relative inline-block">
          <svg width={width} height={height} className="bg-ink rounded border border-elevated">
            {Array.from({ length: grid.cols + 1 }).map((_, i) => (
              <line key={`v${i}`} x1={i * cell} y1={0} x2={i * cell} y2={height} stroke="#1a1f26" strokeWidth="1" />
            ))}
            {Array.from({ length: grid.rows + 1 }).map((_, i) => (
              <line key={`h${i}`} x1={0} y1={i * cell} x2={width} y2={i * cell} stroke="#1a1f26" strokeWidth="1" />
            ))}

            {placed.map((p, i) => (
              <g key={i}>
                <rect
                  x={p.x * cell + 2}
                  y={p.y * cell + 2}
                  width={p.w * cell - 4}
                  height={p.h * cell - 4}
                  fill={missionColors.get(p.item.missionId)}
                  opacity={0.9}
                  rx={3}
                />
                <text
                  x={p.x * cell + (p.w * cell) / 2}
                  y={p.y * cell + (p.h * cell) / 2 + 3}
                  textAnchor="middle"
                  fontSize="9"
                  fill="#0b0d10"
                  fontWeight="600"
                >
                  {p.item.scu}
                </text>
              </g>
            ))}
          </svg>
          {/* Door indicator on the right */}
          <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-gold/60 rounded-sm" title="Door" />
        </div>
      </div>

      {placed.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
          {Array.from(missionColors.entries()).map(([id, color]) => {
            const m = missions.find((x) => x.id === id);
            return (
              <span key={id} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
                <span className="text-accent/70">{m?.pickup.slice(0, 24) || "Mission"}</span>
              </span>
            );
          })}
        </div>
      )}

      {placed.length === 0 && (
        <p className="text-[10px] text-accent/40 mt-2">Check off pickups to load the grid.</p>
      )}
    </div>
  );
}