import type { Mission, Leg } from "./store";
import type { Ship } from "./ships";

export type Stop = {
  type: "pickup" | "dropoff";
  location: string;
  scu: number;
  missionId: string;
  commodity?: string;
};

export type PlannedRoute = {
  stops: Stop[];
  totalReward: number;
  totalScu: number;
  auecPerHour: number;
  distanceScore: number;
};

function getLegs(mission: Mission): Leg[] {
  if (mission.legs && mission.legs.length > 0) return mission.legs;
  // Fallback to single pickup + dropoff
  return [
    { type: "pickup", location: mission.pickup, scu: mission.scu },
    { type: "dropoff", location: mission.dropoff, scu: mission.scu },
  ];
}

function isValidOrder(stops: Stop[]): boolean {
  const picked = new Set<string>();
  for (const s of stops) {
    if (s.type === "pickup") {
      picked.add(s.missionId + s.location);
    } else {
      // Dropoff only allowed after at least one pickup for this mission
      const hasPickup = stops
        .slice(0, stops.indexOf(s))
        .some((p) => p.missionId === s.missionId && p.type === "pickup");
      if (!hasPickup) return false;
    }
  }
  return true;
}

function scoreRoute(stops: Stop[], totalReward: number): number {
  if (!isValidOrder(stops)) return -Infinity;

  // Prefer fewer unique locations (less backtracking)
  const uniqueLocs = new Set(stops.map((s) => s.location)).size;
  const backtrackPenalty = (stops.length - uniqueLocs) * 15;

  // Rough time estimate
  const estimatedMinutes = Math.max(15, stops.length * 10 + uniqueLocs * 5);
  const auecPerHour = (totalReward / estimatedMinutes) * 60;

  return auecPerHour - backtrackPenalty;
}

function mutate(stops: Stop[]): Stop[] {
  const next = [...stops];
  if (next.length < 2) return next;
  const i = Math.floor(Math.random() * next.length);
  const j = Math.floor(Math.random() * next.length);
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export function planRoute(missions: Mission[], ship: Ship): PlannedRoute {
  const totalReward = missions.reduce((sum, m) => sum + m.reward, 0);
  const totalScu = missions.reduce((sum, m) => sum + m.scu, 0);

  // Build initial stop list from all legs
  const baseStops: Stop[] = [];
  for (const m of missions) {
    for (const leg of getLegs(m)) {
      baseStops.push({
        type: leg.type,
        location: leg.location,
        scu: leg.scu,
        missionId: m.id,
        commodity: leg.commodity,
      });
    }
  }

  if (baseStops.length === 0) {
    return { stops: [], totalReward, totalScu, auecPerHour: 0, distanceScore: 0 };
  }

  // Simple GA: population of shuffled routes, keep best valid ones
  const populationSize = 40;
  const generations = 30;
  let population: Stop[][] = [];

  for (let i = 0; i < populationSize; i++) {
    population.push([...baseStops].sort(() => Math.random() - 0.5));
  }

  let best = population[0];
  let bestScore = scoreRoute(best, totalReward);

  for (let g = 0; g < generations; g++) {
    const scored = population
      .map((route) => ({ route, score: scoreRoute(route, totalReward) }))
      .sort((a, b) => b.score - a.score);

    if (scored[0].score > bestScore) {
      best = scored[0].route;
      bestScore = scored[0].score;
    }

    // Keep top half, mutate the rest
    const survivors = scored.slice(0, Math.floor(populationSize / 2)).map((s) => s.route);
    const next: Stop[][] = [...survivors];
    while (next.length < populationSize) {
      const parent = survivors[Math.floor(Math.random() * survivors.length)];
      next.push(mutate(parent));
    }
    population = next;
  }

  const estimatedMinutes = Math.max(15, best.length * 10);
  const auecPerHour = (totalReward / estimatedMinutes) * 60;

  return {
    stops: best,
    totalReward,
    totalScu,
    auecPerHour,
    distanceScore: bestScore,
  };
}