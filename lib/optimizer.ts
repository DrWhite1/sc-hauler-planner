import type { Mission, Leg } from "./store";
import type { Ship } from "./ships";
import { travelMinutes } from "./travel";
import { isValidOrder } from "./routeValidity";

export type Stop = {
  type: "pickup" | "dropoff";
  location: string;
  scu: number;
  missionId: string;
  commodity?: string;
  cargoAfter?: number; // running cargo after this stop
};

export type PlannedRoute = {
  stops: Stop[];
  totalReward: number;
  totalScu: number;
  peakScu: number;
  auecPerHour: number;
  distanceScore: number;
  estimatedMinutes: number;
};

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  }
  return h >>> 0;
}

function getLegs(mission: Mission): Leg[] {
  if (mission.legs && mission.legs.length > 0) return mission.legs;
  return [
    { type: "pickup", location: mission.pickup, scu: mission.scu },
    { type: "dropoff", location: mission.dropoff, scu: mission.scu },
  ];
}

function normalizeLoc(loc: string): string {
  return loc.toLowerCase().replace(/\s+above.*$/, "").replace(/\s+station$/, "").trim();
}

function locationsMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  const na = normalizeLoc(a);
  const nb = normalizeLoc(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}

function peakCargo(stops: Stop[]): number {
  let cargo = 0;
  let peak = 0;
  for (const s of stops) {
    cargo += s.type === "pickup" ? s.scu : -s.scu;
    if (cargo > peak) peak = cargo;
  }
  return Math.max(0, peak);
}

function routeMinutes(stops: Stop[], startLocation: string): number {
  if (stops.length === 0) return 0;
  let mins = 0;
  let prev = startLocation;
  for (const s of stops) {
    mins += travelMinutes(prev, s.location);
    mins += 3; // dock / load / unload estimate
    prev = s.location;
  }
  return Math.max(15, mins);
}

function scoreRoute(stops: Stop[], totalReward: number, startLocation: string, shipScu: number): number {
  if (!isValidOrder(stops)) return -Infinity;

  const peak = peakCargo(stops);
  if (peak > shipScu) return -Infinity; // invalid if it ever exceeds capacity

  let locationChanges = 0;
  for (let i = 1; i < stops.length; i++) {
    if (!locationsMatch(stops[i].location, stops[i - 1].location)) locationChanges++;
  }

  let startBonus = 0;
  if (startLocation && stops.length > 0 && locationsMatch(stops[0].location, startLocation)) {
    startBonus = 500;
  }

  const minutes = routeMinutes(stops, startLocation);
  const auecPerHour = (totalReward / minutes) * 60;

  return auecPerHour - locationChanges * 60 + startBonus - (peak / shipScu) * 20;
}

function mutate(stops: Stop[], rand: () => number): Stop[] {
  const next = [...stops];
  if (next.length < 2) return next;

  if (rand() < 0.5) {
    const i = Math.floor(rand() * next.length);
    const j = Math.floor(rand() * next.length);
    [next[i], next[j]] = [next[j], next[i]];
  } else {
    const i = Math.floor(rand() * next.length);
    const targetLoc = normalizeLoc(next[i].location);
    const same = next
      .map((s, idx) => ({ s, idx }))
      .filter((x) => x.idx !== i && normalizeLoc(x.s.location) === targetLoc);
    if (same.length > 0) {
      const target = same[Math.floor(rand() * same.length)];
      const [moved] = next.splice(i, 1);
      next.splice(target.idx, 0, moved);
    }
  }
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
    return { stops: [], totalReward, totalScu, peakScu: 0, auecPerHour: 0, distanceScore: 0, estimatedMinutes: 0 };
  }

  const seedKey = missions.map((m) => m.id).join("|") + "|" + currentLocation;
  const rand = mulberry32(hashString(seedKey));

  const populationSize = 80;
  const generations = 60;
  let population: Stop[][] = [];

  const grouped = [...baseStops].sort((a, b) => {
    const la = normalizeLoc(a.location);
    const lb = normalizeLoc(b.location);
    if (la !== lb) return la.localeCompare(lb);
    return a.type === "pickup" ? -1 : 1;
  });
  population.push(grouped);

  for (let i = 1; i < populationSize; i++) {
    population.push([...baseStops].sort(() => rand() - 0.5));
  }

  let best = population[0];
  let bestScore = scoreRoute(best, totalReward, currentLocation, ship.scu);

  for (let g = 0; g < generations; g++) {
    const scored = population
      .map((route) => ({ route, score: scoreRoute(route, totalReward, currentLocation, ship.scu) }))
      .sort((a, b) => b.score - a.score);

    if (scored[0].score > bestScore) {
      best = scored[0].route;
      bestScore = scored[0].score;
    }

    const survivors = scored.slice(0, Math.floor(populationSize / 2)).map((s) => s.route);
    const next: Stop[][] = [...survivors];
    while (next.length < populationSize) {
      const parent = survivors[Math.floor(rand() * survivors.length)];
      next.push(mutate(parent, rand));
    }
    population = next;
  }

  // Attach running cargo to each stop
  let cargo = 0;
  const stopsWithCargo = best.map((s) => {
    cargo += s.type === "pickup" ? s.scu : -s.scu;
    return { ...s, cargoAfter: Math.max(0, cargo) };
  });

  const peak = peakCargo(best);
  const estimatedMinutes = routeMinutes(best, currentLocation);
  const auecPerHour = (totalReward / estimatedMinutes) * 60;

  return {
    stops: stopsWithCargo,
    totalReward,
    totalScu,
    peakScu: peak,
    auecPerHour,
    distanceScore: bestScore,
    estimatedMinutes,
  };
}