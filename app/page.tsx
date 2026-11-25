"use client";

import { useState } from "react";
import { ShipSelector } from "@/components/ShipSelector";
import { LocationSelector } from "@/components/LocationSelector";
import { MissionProgress } from "@/components/MissionProgress";
import { MissionForm } from "@/components/MissionForm";
import { MissionOCR } from "@/components/MissionOCR";
import { RouteView } from "@/components/RouteView";
import { useHaulerStore, type Mission } from "@/lib/store";

export default function Home() {
  const { missions, selectedShip, clearMissions, updateMission, removeMission } = useHaulerStore();
  const [editing, setEditing] = useState<Mission | null>(null);

  const saveEdit = () => {
    if (!editing) return;
    updateMission(editing.id, editing);
    setEditing(null);
  };

  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      <header className="mb-8 border-b border-elevated pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-gold">
          SC Hauler Planner
        </h1>
        <p className="mt-2 text-accent/70">
          Stack contracts, optimize routes, maximize aUEC/hour
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-1 space-y-6">
          <ShipSelector />
          <LocationSelector />
          <MissionProgress />
          <MissionOCR />
          <MissionForm />
        </div>

        <div className="md:col-span-2">
          <div className="rounded-lg border border-elevated bg-elevated/50 p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Active Missions ({missions.length})</h2>
              {missions.length > 0 && (
                <button
                  onClick={clearMissions}
                  className="text-sm text-red-400 hover:text-red-300"
                >
                  Clear all
                </button>
              )}
            </div>
            {missions.length === 0 ? (
              <p className="text-accent/50 text-sm">Add missions to plan a route.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {missions.map((m) => (
                  <li key={m.id} className="border-b border-ink/50 py-2">
                    <button
                      onClick={() => setEditing(m)}
                      className="w-full text-left hover:bg-ink/40 rounded px-1 -mx-1"
                    >
                      <div className="flex justify-between">
                        <span>{m.pickup} → {m.dropoff}</span>
                        <span className="text-gold">{m.reward.toLocaleString()} aUEC · {m.scu} SCU</span>
                      </div>
                      {m.legs && m.legs.length > 2 && (
                        <div className="text-[10px] text-accent/50 mt-0.5">
                          {m.legs.length} legs
                        </div>
                      )}
                    </button>
                  </li>
                ))}
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
              <div className="grid grid-cols-2 gap-2 mb-3">
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

          <div className="mt-6">
            <RouteView />
          </div>
        </div>
      </div>
    </main>
  );
}