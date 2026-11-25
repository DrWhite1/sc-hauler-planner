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
import { VoicePanel } from "@/components/VoicePanel";
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
    <main className="container mx-auto px-4 py-6 max-w-7xl">
      <header className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gold">SC Hauler Planner</h1>
          <p className="text-xs text-accent/40 mt-0.5">Stack contracts · optimize routes · maximize aUEC/hour</p>
        </div>
        {progress.total > 0 && (
          <div className="w-48">
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

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-3 space-y-3">
          <ShipSelector />
          <LocationSelector />
          <MissionProgress />
          <VoicePanel />
          <details className="panel">
            <summary className="px-4 py-2.5 text-xs uppercase tracking-wider text-accent/50 cursor-pointer">
              Add / OCR
            </summary>
            <div className="px-3 pb-3 space-y-3">
              <MissionOCR />
              <MissionForm />
            </div>
          </details>
        </div>

        <div className="lg:col-span-9 space-y-3">
          <div className="panel p-3">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-medium uppercase tracking-wider text-accent/50">
                Missions ({missions.length})
              </h2>
              {missions.length > 0 && (
                <button onClick={clearMissions} className="text-[10px] text-red-400/70 hover:text-red-300">
                  Clear
                </button>
              )}
            </div>
            {missions.length === 0 ? (
              <p className="text-accent/35 text-xs py-1">Add missions to plan a route.</p>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {missions.map((m) => {
                  const left = remainingMinutes(m);
                  const tooBig = containerTooBig(m);
                  return (
                    <button
                      key={m.id}
                      onClick={() => setEditing(m)}
                      className="flex-shrink-0 w-56 text-left rounded-lg border border-elevated/60 bg-ink/50 hover:bg-ink/80 px-3 py-2 transition"
                    >
                      <div className="text-xs truncate">{m.pickup} → {m.dropoff}</div>
                      <div className="flex justify-between mt-1">
                        <span className="text-gold text-xs font-medium">{m.reward.toLocaleString()}</span>
                        <span className="text-[10px] text-accent/40">{m.scu} SCU</span>
                      </div>
                      {(left !== null || tooBig) && (
                        <div className="text-[9px] mt-1 text-accent/40">
                          {left !== null && (left === 0 ? "Expired" : `${left} min`)}
                          {tooBig && " · too big"}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {editing && (
            <div className="panel p-3 text-sm border-gold/30">
              <h3 className="font-medium mb-2 text-gold text-xs">Edit</h3>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <input value={editing.pickup} onChange={(e) => setEditing({ ...editing, pickup: e.target.value })} className="rounded bg-ink border border-elevated px-2 py-1 text-xs" placeholder="Pickup" />
                <input value={editing.dropoff} onChange={(e) => setEditing({ ...editing, dropoff: e.target.value })} className="rounded bg-ink border border-elevated px-2 py-1 text-xs" placeholder="Dropoff" />
              </div>
              <div className="flex gap-2">
                <button onClick={saveEdit} className="rounded bg-gold text-ink px-2 py-1 text-xs font-medium">Save</button>
                <button onClick={() => setEditing(null)} className="rounded border border-elevated px-2 py-1 text-xs">Cancel</button>
                <button onClick={() => { removeMission(editing.id); setEditing(null); }} className="rounded text-red-400 border border-red-400/30 px-2 py-1 text-xs ml-auto">Delete</button>
              </div>
            </div>
          )}

          <div className="grid gap-3 lg:grid-cols-5">
            <div className="lg:col-span-3 space-y-3">
              <RouteView />
              <RouteMap />
            </div>
            <div className="lg:col-span-2 space-y-3">
              <PackingView />
              <CargoGrid />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}