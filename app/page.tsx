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
      <header className="mb-6 border-b border-elevated pb-5">
        <h1 className="text-3xl font-bold tracking-tight text-gold">
          SC Hauler Planner
        </h1>
        <p className="mt-1 text-sm text-accent/60">
          Stack contracts, optimize routes, maximize aUEC/hour
        </p>
        {progress.total > 0 && (
          <div className="mt-3">
            <div className="flex justify-between text-[10px] text-accent/50 mb-1">
              <span>Run progress</span>
              <span>{progress.done}/{progress.total} stops · {pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-ink overflow-hidden">
              <div className="h-full bg-gold transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </header>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-1 space-y-5">
          <ShipSelector />
          <LocationSelector />
          <MissionProgress />
          <MissionOCR />
          <MissionForm />
        </div>

        <div className="md:col-span-2">
          <div className="rounded-lg border border-elevated bg-elevated/40 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium uppercase tracking-wider text-accent/60">
                Active Missions ({missions.length})
              </h2>
              {missions.length > 0 && (
                <button
                  onClick={clearMissions}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Clear all
                </button>
              )}
            </div>
            {missions.length === 0 ? (
              <p className="text-accent/40 text-sm">Add missions to plan a route.</p>
            ) : (
              <ul className="space-y-2">
                {missions.map((m) => {
                  const left = remainingMinutes(m);
                  const tooBig = containerTooBig(m);
                  return (
                    <li key={m.id}>
                      <button
                        onClick={() => setEditing(m)}
                        className="w-full text-left rounded-md border border-elevated bg-ink/40 hover:bg-ink/70 px-3 py-2.5 transition"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm truncate">{m.pickup} → {m.dropoff}</div>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {m.legs && m.legs.length > 2 && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-elevated text-accent/60">
                                  {m.legs.length} legs
                                </span>
                              )}
                              {m.maxContainerSize && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-elevated text-accent/60">
                                  {m.maxContainerSize} SCU boxes
                                </span>
                              )}
                              {left !== null && (
                                <span className={`text-[9px] px-1.5 py-0.5 rounded ${left < 30 ? "bg-red-900/40 text-red-300" : "bg-elevated text-accent/60"}`}>
                                  {left === 0 ? "Expired" : `${left} min`}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-gold text-sm font-medium">{m.reward.toLocaleString()}</div>
                            <div className="text-[10px] text-accent/50">{m.scu} SCU</div>
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
            <div className="mt-4 rounded-lg border border-gold/40 bg-elevated/70 p-4 text-sm">
              <h3 className="font-medium mb-3 text-gold">Edit Mission</h3>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <input
                  value={editing.pickup}
                  onChange={(e) => setEditing({ ...editing, pickup: e.target.value })}
                  className="rounded bg-ink border border-elevated px-2 py-1"
                  placeholder="Pickup"
                />
                <input
                  value={editing.dropoff}
                  onChange={(e) => setEditing({ ...editing, dropoff: e.target.value })}
                  className="rounded bg-ink border border-elevated px-2 py-1"
                  placeholder="Dropoff"
                />
              </div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <input
                  type="number"
                  value={editing.reward}
                  onChange={(e) => setEditing({ ...editing, reward: Number(e.target.value) })}
                  className="rounded bg-ink border border-elevated px-2 py-1"
                  placeholder="Reward"
                />
                <input
                  type="number"
                  value={editing.scu}
                  onChange={(e) => setEditing({ ...editing, scu: Number(e.target.value) })}
                  className="rounded bg-ink border border-elevated px-2 py-1"
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
                  className="rounded bg-ink border border-elevated px-2 py-1"
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
                  className="rounded bg-ink border border-elevated px-2 py-1"
                  placeholder="Max container (SCU)"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={saveEdit} className="rounded bg-gold text-ink px-3 py-1 text-sm">
                  Save
                </button>
                <button onClick={() => setEditing(null)} className="rounded border border-elevated px-3 py-1 text-sm">
                  Cancel
                </button>
                <button
                  onClick={() => {
                    removeMission(editing.id);
                    setEditing(null);
                  }}
                  className="rounded text-red-400 border border-red-400/40 px-3 py-1 text-sm ml-auto"
                >
                  Delete
                </button>
              </div>
            </div>
          )}

          <div className="mt-5">
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