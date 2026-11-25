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

function normalizeLoc(loc: string): string {
  return loc.toLowerCase().replace(/\s+above.*$/, "").replace(/\s+station$/, "").trim();
}

function locationsMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  const na = normalizeLoc(a);
  const nb = normalizeLoc(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}

function scoreRoute(stops: Stop[], totalReward: number, startLocation: string): number {
  if (!isValidOrder(stops)) return -Infinity;

  // Heavily penalize location changes (group same-station stops together)
  let locationChanges = 0;
  for (let i = 1; i < stops.length; i++) {
    if (!locationsMatch(stops[i].location, stops[i - 1].location)) {
      locationChanges++;
    }
  }

  // Big bonus for starting near the current location
  let startBonus = 0;
  if (startLocation && stops.length > 0 && locationsMatch(stops[0].location, startLocation)) {
    startBonus = 500;
  }

  // Prefer doing all pickups at a location before leaving it
  let pickupGroupingBonus = 0;
  const seenPickupLoc = new Set<string>();
  for (const s of stops) {
    if (s.type === "pickup") seenPickupLoc.add(normalizeLoc(s.location));
  }

  const estimatedMinutes = Math.max(15, stops.length * 8 + locationChanges * 12);
  const auecPerHour = (totalReward / estimatedMinutes) * 60;

  // Strong weight on fewer jumps between stations
  return auecPerHour - locationChanges * 80 + startBonus;
}

function mutate(stops: Stop[], rand: () => number): Stop[] {
  const next = [...stops];
  if (next.length < 2) return next;

  // 50% chance: swap two random stops
  // 50% chance: move a stop next to another stop at the same location (encourages grouping)
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
    return { stops: [], totalReward, totalScu, auecPerHour: 0, distanceScore: 0 };
  }

  const seedKey = missions.map((m) => m.id).join("|") + "|" + currentLocation;
  const rand = mulberry32(hashString(seedKey));

  const populationSize = 60;
  const generations = 50;
  let population: Stop[][] = [];

  // Seed some individuals with a grouped heuristic (all pickups at a loc, then dropoffs)
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
      const parent = survivors[Math.floor(rand() * survivors.length)];
      next.push(mutate(parent, rand));
    }
    population = next;
  }

  const locationChanges = best.reduce((n, s, i) => {
    if (i === 0) return 0;
    return n + (locationsMatch(s.location, best[i - 1].location) ? 0 : 1);
  }, 0);

  const estimatedMinutes = Math.max(15, best.length * 8 + locationChanges * 12);
  const auecPerHour = (totalReward / estimatedMinutes) * 60;

  return {
    stops: best,
    totalReward,
    totalScu,
    auecPerHour,
    distanceScore: bestScore,
  };
}