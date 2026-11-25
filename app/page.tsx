"use client";

import { ShipSelector } from "@/components/ShipSelector";
import { MissionForm } from "@/components/MissionForm";
import { MissionOCR } from "@/components/MissionOCR";
import { RouteView } from "@/components/RouteView";
import { useHaulerStore } from "@/lib/store";

export default function Home() {
  const { missions, selectedShip, clearMissions } = useHaulerStore();

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
                  <li key={m.id} className="flex justify-between border-b border-ink/50 py-2">
                    <span>{m.pickup} → {m.dropoff}</span>
                    <span className="text-gold">{m.reward.toLocaleString()} aUEC · {m.scu} SCU</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-6">
            <RouteView />
          </div>
        </div>
      </div>
    </main>
  );
}