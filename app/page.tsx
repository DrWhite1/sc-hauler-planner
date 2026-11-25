"use client";

import { useState, useEffect, useMemo } from "react";
import { ShipSelector } from "@/components/ShipSelector";
import { LocationSelector } from "@/components/LocationSelector";
import { MissionProgress } from "@/components/MissionProgress";
import { MissionForm } from "@/components/MissionForm";
import { MissionOCR } from "@/components/MissionOCR";
import { RouteView } from "@/components/RouteView";
import { RouteMap } from "@/components/RouteMap";
import { PackingView } from "@/components/PackingView";
import { CargoGrid } from "@/components/CargoGrid";
import { useHaulerStore, type Mission } from "@/lib/store";
import { planRoute } from "@/lib/optimizer";

function remainingMinutes(m: Mission): number | null {
  if (!m.availableMinutes || !m.addedAt) return null;
  const elapsed = (Date.now() - m.addedAt) / 60000;
  return Math.max(0, Math.round(m.availableMinutes - elapsed));
}

export default function Home() {
  const { missions, selectedShip, currentLocation, clearMissions, updateMission, removeMission, completedStops } = useHaulerStore();
  const [editing, setEditing] = useState<Mission | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const saveEdit = () => {
    if (!editing) return;
    updateMission(editing.id, editing);
    setEditing(null);
  };

  const containerTooBig = (m: Mission) =>
    selectedShip && m.maxContainerSize && m.maxContainerSize > selectedShip.maxContainer;

  const progress = useMemo(() => {
    if (!selectedShip || missions.length === 0) return { done: 0, total: 0 };
    const route = planRoute(missions, selectedShip, currentLocation);
    const total = route.stops.length;
    const done = route.stops.filter((s) =>
      completedStops.includes(`${s.missionId}:${s.type}:${s.location}`)
    ).length;
    return { done, total };
  }, [missions, selectedShip, currentLocation, completedStops]);

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      <header className="mb-6 pb-5">
        <h1 className="text-3xl font-bold tracking-tight text-gold">
          SC Hauler Planner
        </h1>
        <p className="mt-1 text-sm text-accent/50">
          Stack contracts, optimize routes, maximize aUEC/hour
        </p>
        {progress.total > 0 && (
          <div className="mt-4 max-w-xs">
            <div className="flex justify-between text-[10px] text-accent/40 mb-1">
              <span>Run</span>
              <span>{progress.done}/{progress.total} · {pct}%</span>
            </div>
            <div className="h-1 rounded-full bg-ink overflow-hidden">
              <div className="h-full bg-gradient-to-r from-sage to-gold transition-all duration-300" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </header>

      <div className="grid gap-5 md:grid-cols-3">
        <div className="md:col-span-1 space-y-4">
          <ShipSelector />
          <LocationSelector />
          <MissionProgress />
          <MissionOCR />
          <MissionForm />
        </div>

        <div className="md:col-span-2">
          <div className="panel p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-medium uppercase tracking-wider text-accent/50">
                Active Missions ({missions.length})
              </h2>
              {missions.length > 0 && (
                <button
                  onClick={clearMissions}
                  className="text-[10px] text-red-400/70 hover:text-red-300 transition"
                >
                  Clear all
                </button>
              )}
            </div>
            {missions.length === 0 ? (
              <p className="text-accent/35 text-sm py-2">Add missions to plan a route.</p>
            ) : (
              <ul className="space-y-2">
                {missions.map((m) => {
                  const left = remainingMinutes(m);
                  const tooBig = containerTooBig(m);
                  return (
                    <li key={m.id}>
                      <button
                        onClick={() => setEditing(m)}
                        className="w-full text-left rounded-lg border border-elevated/60 bg-ink/50 hover:bg-ink/80 hover:border-elevated px-3 py-2.5 transition"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm truncate">{m.pickup} → {m.dropoff}</div>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {m.legs && m.legs.length > 2 && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-elevated/80 text-accent/50">
                                  {m.legs.length} legs
                                </span>
                              )}
                              {m.maxContainerSize && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-elevated/80 text-accent/50">
                                  {m.maxContainerSize} SCU boxes
                                </span>
                              )}
                              {left !== null && (
                                <span className={`text-[9px] px-1.5 py-0.5 rounded ${left < 30 ? "bg-red-900/50 text-red-300" : "bg-elevated/80 text-accent/50"}`}>
                                  {left === 0 ? "Expired" : `${left} min`}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-gold text-sm font-semibold tabular-nums">{m.reward.toLocaleString()}</div>
                            <div className="text-[10px] text-accent/40">{m.scu} SCU</div>
                          </div>
                        </div>
                        {tooBig && (
                          <div className="text-[10px] text-red-400 mt-1.5">
                            Container too big for {selectedShip?.name} (max {selectedShip?.maxContainer} SCU)
                          </div>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {editing && (
            <div className="mt-4 panel p-4 text-sm border-gold/30">
              <h3 className="font-medium mb-3 text-gold">Edit Mission</h3>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <input
                  value={editing.pickup}
                  onChange={(e) => setEditing({ ...editing, pickup: e.target.value })}
                  className="rounded bg-ink border border-elevated px-2 py-1.5"
                  placeholder="Pickup"
                />
                <input
                  value={editing.dropoff}
                  onChange={(e) => setEditing({ ...editing, dropoff: e.target.value })}
                  className="rounded bg-ink border border-elevated px-2 py-1.5"
                  placeholder="Dropoff"
                />
              </div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <input
                  type="number"
                  value={editing.reward}
                  onChange={(e) => setEditing({ ...editing, reward: Number(e.target.value) })}
                  className="rounded bg-ink border border-elevated px-2 py-1.5"
                  placeholder="Reward"
                />
                <input
                  type="number"
                  value={editing.scu}
                  onChange={(e) => setEditing({ ...editing, scu: Number(e.target.value) })}
                  className="rounded bg-ink border border-elevated px-2 py-1.5"
                  placeholder="SCU"
                />
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <input
                  type="number"
                  value={editing.availableMinutes ?? ""}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      availableMinutes: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="rounded bg-ink border border-elevated px-2 py-1.5"
                  placeholder="Time left (min)"
                />
                <input
                  type="number"
                  value={editing.maxContainerSize ?? ""}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      maxContainerSize: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="rounded bg-ink border border-elevated px-2 py-1.5"
                  placeholder="Max container (SCU)"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={saveEdit} className="rounded bg-gold text-ink px-3 py-1.5 text-sm font-medium">
                  Save
                </button>
                <button onClick={() => setEditing(null)} className="rounded border border-elevated px-3 py-1.5 text-sm">
                  Cancel
                </button>
                <button
                  onClick={() => {
                    removeMission(editing.id);
                    setEditing(null);
                  }}
                  className="rounded text-red-400 border border-red-400/30 px-3 py-1.5 text-sm ml-auto"
                >
                  Delete
                </button>
              </div>
            </div>
          )}

          <div className="mt-4">
            <RouteView />
            <RouteMap />
            <PackingView />
            <CargoGrid />
          </div>
        </div>
      </div>
    </main>
  );
}