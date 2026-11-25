import type { Mission } from "./store";
import type { Ship } from "./ships";

export type Stop = {
  type: "pickup" | "dropoff";
  location: string;
  scu: number;
  missionId: string;
};

export type PlannedRoute = {
  stops: Stop[];
  totalReward: number;
  totalScu: number;
  auecPerHour: number;
};

// Very simple greedy planner for Phase 1.
// Later replace with a proper genetic algorithm / constrained TSP.
export function planRoute(missions: Mission[], ship: Ship): PlannedRoute {
  const totalReward = missions.reduce((sum, m) => sum + m.reward, 0);
  const totalScu = missions.reduce((sum, m) => sum + m.scu, 0);

  // Naive order: all pickups first, then all dropoffs (user can improve later)
  const stops: Stop[] = [];

  for (const m of missions) {
    stops.push({
      type: "pickup",
      location: m.pickup,
      scu: m.scu,
      missionId: m.id,
    });
  }
  for (const m of missions) {
    stops.push({
      type: "dropoff",
      location: m.dropoff,
      scu: m.scu,
      missionId: m.id,
    });
  }

  // Rough estimate: assume 15 min average per stop + quantum travel
  const estimatedMinutes = Math.max(20, stops.length * 12);
  const auecPerHour = (totalReward / estimatedMinutes) * 60;

  return {
    stops,
    totalReward,
    totalScu,
    auecPerHour,
  };
}