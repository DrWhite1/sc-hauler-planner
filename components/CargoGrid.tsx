"use client";

import { useMemo } from "react";
import { useHaulerStore } from "@/lib/store";
import { planRoute } from "@/lib/optimizer";
import { buildPackingOrder } from "@/lib/packing";
import { getGrid } from "@/lib/grids";
import { packGrid } from "@/lib/packer";

const COLORS = ["#6f9e86", "#c5a46e", "#7a9cc6", "#b07a7a", "#9a8ab0", "#8ab0a0"];

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

    // Track which mission+pickup combos are on board.
    // A completed dropoff for a mission removes all of that mission's cargo.
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
  const cell = 14;
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
    <div className="rounded-lg border border-elevated bg-elevated/50 p-4 mt-4">
      <h3 className="text-sm font-medium uppercase tracking-wider text-accent/60 mb-2">
        Cargo Grid — {selectedShip.name}
      </h3>
      <p className="text-[10px] text-accent/40 mb-3">
        Door → right · currently on board: {onBoardScu} SCU
        {placed.length === 0 && " (check off pickups to load)"}
      </p>

      <div className="overflow-auto">
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
                x={p.x * cell + 1}
                y={p.y * cell + 1}
                width={p.w * cell - 2}
                height={p.h * cell - 2}
                fill={missionColors.get(p.item.missionId)}
                opacity={0.85}
                rx={2}
              />
              {p.w * cell > 30 && p.h * cell > 12 && (
                <text
                  x={p.x * cell + (p.w * cell) / 2}
                  y={p.y * cell + (p.h * cell) / 2 + 3}
                  textAnchor="middle"
                  fontSize="8"
                  fill="#0b0d10"
                >
                  {p.item.commodity?.slice(0, 6) || p.item.scu}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>

      {placed.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
          {Array.from(missionColors.entries()).map(([id, color]) => {
            const m = missions.find((x) => x.id === id);
            return (
              <span key={id} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm" style={{ background: color }} />
                {m?.pickup.slice(0, 20) || "Mission"}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}