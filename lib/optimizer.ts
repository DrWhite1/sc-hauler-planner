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
  return [
    { type: "pickup", location: mission.pickup, scu: mission.scu },
    { type: "dropoff", location: mission.dropoff, scu: mission.scu },
  ];
}

function isValidOrder(stops: Stop[]): boolean {
  for (const s of stops) {
    if (s.type === "dropoff") {
      const hasPickup = stops
        .slice(0, stops.indexOf(s))
        .some((p) => p.missionId === s.missionId && p.type === "pickup");
      if (!hasPickup) return false;
    }
  }
  return true;
}

function locationSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const al = a.toLowerCase();
  const bl = b.toLowerCase();
  if (al === bl) return 100;
  if (al.includes(bl) || bl.includes(al)) return 60;
  // Shared tokens (e.g. "Station", planet names)
  const aTokens = al.split(/\s+/);
  const bTokens = bl.split(/\s+/);
  const shared = aTokens.filter((t) => bTokens.includes(t) && t.length > 3).length;
  return shared * 20;
}

function scoreRoute(stops: Stop[], totalReward: number, startLocation: string): number {
  if (!isValidOrder(stops)) return -Infinity;

  const uniqueLocs = new Set(stops.map((s) => s.location)).size;
  const backtrackPenalty = (stops.length - uniqueLocs) * 15;

  // Bonus if first stop is close to current location
  let startBonus = 0;
  if (startLocation && stops.length > 0) {
    startBonus = locationSimilarity(stops[0].location, startLocation) * 2;
  }

  const estimatedMinutes = Math.max(15, stops.length * 10 + uniqueLocs * 5);
  const auecPerHour = (totalReward / estimatedMinutes) * 60;

  return auecPerHour - backtrackPenalty + startBonus;
}

function mutate(stops: Stop[]): Stop[] {
  const next = [...stops];
  if (next.length < 2) return next;
  const i = Math.floor(Math.random() * next.length);
  const j = Math.floor(Math.random() * next.length);
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export function planRoute(
  missions: Mission[],
  ship: Ship,
  currentLocation: string = ""
): PlannedRoute {
  const totalReward = missions.reduce((sum, m) => sum + m.reward, 0);
  const totalScu = missions.reduce((sum, m) => sum + m.scu, 0);

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

  const populationSize = 40;
  const generations = 30;
  let population: Stop[][] = [];

  for (let i = 0; i < populationSize; i++) {
    population.push([...baseStops].sort(() => Math.random() - 0.5));
  }

  let best = population[0];
  let bestScore = scoreRoute(best, totalReward, currentLocation);

  for (let g = 0; g < generations; g++) {
    const scored = population
      .map((route) => ({ route, score: scoreRoute(route, totalReward, currentLocation) }))
      .sort((a, b) => b.score - a.score);

    if (scored[0].score > bestScore) {
      best = scored[0].route;
      bestScore = scored[0].score;
    }

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