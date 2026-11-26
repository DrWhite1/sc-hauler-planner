import type { Mission, Leg } from "./store";
import type { Ship } from "./ships";
import { travelMinutes, distanceGm, canonicalLocation, UNKNOWN_TRAVEL_MINUTES } from "./travel";

export type Stop = {
  type: "pickup" | "dropoff";
  location: string;
  scu: number;
  missionId: string;
  commodity?: string;
  scuEstimated?: boolean; // pickup amount is an even split, the contract does not state it
  cargoAfter?: number; // running cargo after this stop
};

export type PlannedRoute = {
  stops: Stop[];
  totalReward: number;
  totalScu: number;
  peakScu: number;
  auecPerHour: number;
  distanceScore: number; // total quantum distance in Gm (0 where a distance is unknown)
  estimatedMinutes: number;
  optimal?: boolean; // true when the order was proven fastest by exhaustive search
};

// Loading / unloading estimate per stop (elevator or cargo deck), on top of travel.
export const HANDLING_MINUTES_PER_STOP = 3;
// Up to this many stops the planner searches every order (exact dynamic programming).
// 2^16 cargo states x places stays well under 100 ms; above it a local search is used.
export const EXACT_MAX_STOPS = 18;

// ---------------------------------------------------------------------------------------------
// Problem set-up

type Problem = {
  stops: Stop[];
  n: number;
  loc: number[]; // place index per stop; place 0 is the start (may have no stops)
  places: string[];
  T: number[][]; // travel minutes between places
  startKnown: boolean;
  cap: number;
  delta: number[]; // +scu for a pickup, -scu for a dropoff
  key: number[]; // cargo key per stop (mission, or mission+commodity), see routeValidity.ts
};

function getLegs(mission: Mission): Leg[] {
  if (mission.legs && mission.legs.length > 0) return mission.legs;
  return [
    { type: "pickup", location: mission.pickup, scu: mission.scu },
    { type: "dropoff", location: mission.dropoff, scu: mission.scu },
  ];
}

function placeKey(loc: string): string {
  return canonicalLocation(loc) ?? loc.toLowerCase().replace(/\s+/g, " ").trim();
}

// Same rule as isValidOrder: cargo is tracked per commodity when every pickup and dropoff of a
// mission names the same commodities, otherwise per mission total.
function cargoKeys(stops: Stop[]): number[] {
  const pick = new Map<string, Set<string>>();
  const drop = new Map<string, Set<string>>();
  for (const s of stops) {
    const t = s.type === "pickup" ? pick : drop;
    const set = t.get(s.missionId) ?? new Set<string>();
    set.add(s.commodity ?? "");
    t.set(s.missionId, set);
  }
  const perCommodity = new Map<string, boolean>();
  for (const [id, p] of pick) {
    const d = drop.get(id) ?? new Set<string>();
    perCommodity.set(id, p.size === d.size && [...p].every((c) => c !== "" && d.has(c)));
  }
  const ids = new Map<string, number>();
  return stops.map((s) => {
    const k = perCommodity.get(s.missionId) ? `${s.missionId}|${s.commodity}` : s.missionId;
    if (!ids.has(k)) ids.set(k, ids.size);
    return ids.get(k)!;
  });
}

function buildProblem(stops: Stop[], startLocation: string, cap: number): Problem {
  const places: string[] = [startLocation ? placeKey(startLocation) : "\u0000start"];
  const names: string[] = [startLocation];
  const loc = stops.map((s) => {
    const k = placeKey(s.location);
    let i = places.indexOf(k);
    if (i < 0) {
      places.push(k);
      names.push(s.location);
      i = places.length - 1;
    }
    return i;
  });
  const L = places.length;
  const startKnown = !!startLocation;
  const T: number[][] = [];
  for (let a = 0; a < L; a++) {
    T.push([]);
    for (let b = 0; b < L; b++) {
      if (a === b) T[a].push(0);
      else if (!startKnown && a === 0) T[a].push(0); // unknown start: first flight counted separately
      else if (!startKnown && b === 0) T[a].push(1e6); // never "return" to an unknown start
      else T[a].push(travelMinutes(names[a], names[b]));
    }
  }
  return {
    stops,
    n: stops.length,
    loc,
    places,
    T,
    startKnown,
    cap,
    delta: stops.map((s) => (s.type === "pickup" ? s.scu : -s.scu)),
    key: cargoKeys(stops),
  };
}

// ---------------------------------------------------------------------------------------------
// Cost and feasibility of a full order (indices into problem.stops)

function travelOf(p: Problem, order: number[]): number {
  let t = 0;
  let prev = 0;
  for (const i of order) {
    t += p.T[prev][p.loc[i]];
    prev = p.loc[i];
  }
  return t;
}

// 0 = valid, otherwise how badly it breaks the rules (used to repair invalid inputs).
function violation(p: Problem, order: number[], checkCap: boolean): number {
  const onboard = new Map<number, number>();
  let load = 0;
  let bad = 0;
  for (const i of order) {
    const k = p.key[i];
    const have = onboard.get(k) ?? 0;
    if (p.delta[i] < 0) {
      const need = -p.delta[i];
      if (have < need) bad += need - have;
      onboard.set(k, Math.max(0, have - need));
      load = Math.max(0, load - need);
    } else {
      onboard.set(k, have + p.delta[i]);
      load += p.delta[i];
      if (checkCap && load > p.cap) bad += load - p.cap;
    }
  }
  return bad;
}

function visitsOf(p: Problem, order: number[]): number {
  let v = 0;
  let prev = 0;
  for (const i of order) {
    if (p.loc[i] !== prev) v++;
    prev = p.loc[i];
  }
  return v;
}

// ---------------------------------------------------------------------------------------------
// Exact search: dynamic programming over (set of stops done, current place).
// The cargo on board and every pickup-before-dropoff check depend only on the set done, so the
// state space is 2^n x places and the result is the fastest order under the travel model.

function solveExact(p: Problem, checkCap: boolean): number[] | null {
  const { n, loc, T, delta, key } = p;
  const L = p.places.length;
  const S = 1 << n;
  const load = new Int32Array(S);
  const keys = Math.max(...key) + 1;
  const onboard = new Int32Array(S * keys);
  for (let m = 1; m < S; m++) {
    const low = 31 - Math.clz32(m & -m);
    const prev = m & (m - 1);
    load[m] = load[prev] + delta[low];
    for (let k = 0; k < keys; k++) onboard[m * keys + k] = onboard[prev * keys + k];
    onboard[m * keys + key[low]] += delta[low];
  }
  const INF = 1e30;
  const dp = new Float32Array(S * L).fill(INF);
  const from = new Uint8Array(S * L); // previous place
  const via = new Uint8Array(S * L); // stop taken to get here
  dp[0 * L + 0] = 0;
  for (let m = 0; m < S; m++) {
    for (let a = 0; a < L; a++) {
      const c = dp[m * L + a];
      if (c >= INF) continue;
      for (let i = 0; i < n; i++) {
        if (m & (1 << i)) continue;
        if (delta[i] < 0) {
          if (onboard[m * keys + key[i]] < -delta[i]) continue;
        } else if (checkCap && load[m] + delta[i] > p.cap) continue;
        const b = loc[i];
        const nm = m | (1 << i);
        const nc = c + T[a][b];
        const idx = nm * L + b;
        if (nc < dp[idx] - 1e-4) {
          dp[idx] = nc;
          from[idx] = a;
          via[idx] = i;
        }
      }
    }
  }
  const full = S - 1;
  let best = -1;
  let bestCost = INF;
  for (let a = 0; a < L; a++) {
    if (dp[full * L + a] < bestCost) {
      bestCost = dp[full * L + a];
      best = a;
    }
  }
  if (best < 0) return null;
  const order: number[] = [];
  let m = full;
  let a = best;
  while (m) {
    const idx = m * L + a;
    const i = via[idx];
    order.push(i);
    a = from[idx];
    m &= ~(1 << i);
  }
  return order.reverse();
}

// ---------------------------------------------------------------------------------------------
// Heuristic for longer lists: greedy construction from several starts, then local search
// (move one stop, move a whole same-place run, swap two runs) keeping the order valid, repeated
// with random kicks. Deterministic for the same missions.

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
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return h >>> 0;
}

function greedy(p: Problem, checkCap: boolean, rand: (() => number) | null): number[] | null {
  const done = new Array(p.n).fill(false);
  const onboard = new Map<number, number>();
  let load = 0;
  let at = 0;
  const order: number[] = [];
  for (let step = 0; step < p.n; step++) {
    const cand: { i: number; c: number }[] = [];
    for (let i = 0; i < p.n; i++) {
      if (done[i]) continue;
      if (p.delta[i] < 0) {
        if ((onboard.get(p.key[i]) ?? 0) < -p.delta[i]) continue;
      } else if (checkCap && load + p.delta[i] > p.cap) continue;
      // Dropoffs first where it costs nothing; they free space.
      cand.push({ i, c: p.T[at][p.loc[i]] + (p.delta[i] < 0 ? 0 : 1e-6) });
    }
    if (cand.length === 0) return null;
    cand.sort((x, y) => x.c - y.c);
    let pick = cand[0];
    if (rand && cand[0].c > 0 && cand.length > 1 && rand() < 0.35) {
      pick = cand[Math.min(cand.length - 1, 1 + Math.floor(rand() * Math.min(3, cand.length - 1)))];
    }
    const i = pick.i;
    done[i] = true;
    order.push(i);
    onboard.set(p.key[i], (onboard.get(p.key[i]) ?? 0) + p.delta[i]);
    load += p.delta[i];
    at = p.loc[i];
  }
  return order;
}

function runs(p: Problem, order: number[]): [number, number][] {
  const r: [number, number][] = [];
  let s = 0;
  for (let i = 1; i <= order.length; i++) {
    if (i === order.length || p.loc[order[i]] !== p.loc[order[s]]) {
      r.push([s, i]);
      s = i;
    }
  }
  return r;
}

function moveBlock(order: number[], s: number, e: number, to: number): number[] {
  const block = order.slice(s, e);
  const rest = order.slice(0, s).concat(order.slice(e));
  return rest.slice(0, to).concat(block, rest.slice(to));
}

function localSearch(p: Problem, start: number[], checkCap: boolean, deadline: number): number[] {
  let cur = start;
  let curCost = travelOf(p, cur);
  let improved = true;
  while (improved && Date.now() < deadline) {
    improved = false;
    const tryOrder = (o: number[]) => {
      const c = travelOf(p, o);
      if (c < curCost - 1e-9 && violation(p, o, checkCap) === 0) {
        cur = o;
        curCost = c;
        improved = true;
        return true;
      }
      return false;
    };
    // Move a whole run of stops at one place, or a single stop, to every other position.
    const blocks: [number, number][] = runs(p, cur);
    for (let i = 0; i < cur.length; i++) blocks.push([i, i + 1]);
    outer: for (const [s, e] of blocks) {
      const len = cur.length - (e - s);
      for (let to = 0; to <= len; to++) {
        if (to === s) continue;
        if (tryOrder(moveBlock(cur, s, e, to))) break outer;
      }
    }
    if (improved) continue;
    // Swap two runs.
    const r = runs(p, cur);
    outer2: for (let x = 0; x < r.length; x++) {
      for (let y = x + 1; y < r.length; y++) {
        const [s1, e1] = r[x];
        const [s2, e2] = r[y];
        const o = cur
          .slice(0, s1)
          .concat(cur.slice(s2, e2), cur.slice(e1, s2), cur.slice(s1, e1), cur.slice(e2));
        if (tryOrder(o)) break outer2;
      }
    }
  }
  return cur;
}

// A fixed number of rounds keeps the result the same on every run; the time limit is only a guard.
const HEURISTIC_ROUNDS = 150;
const HEURISTIC_MAX_MS = 250;

function solveHeuristic(p: Problem, checkCap: boolean, seed: number): number[] | null {
  const deadline = Date.now() + HEURISTIC_MAX_MS;
  const rand = mulberry32(seed);
  let best: number[] | null = null;
  let bestCost = Infinity;
  const consider = (o: number[] | null) => {
    if (!o) return;
    const c = travelOf(p, o);
    if (c < bestCost - 1e-9) {
      best = o;
      bestCost = c;
    }
  };
  const first = greedy(p, checkCap, null);
  if (first) consider(localSearch(p, first, checkCap, deadline));
  let iter = 0;
  while (Date.now() < deadline && iter < HEURISTIC_ROUNDS) {
    iter++;
    let start: number[] | null;
    if (best && iter % 2 === 0) {
      // Kick: move two random stops, keep only if still valid.
      start = [...(best as number[])];
      for (let k = 0; k < 2; k++) {
        const s = Math.floor(rand() * start.length);
        const to = Math.floor(rand() * (start.length - 1));
        start = moveBlock(start, s, s + 1, to);
      }
      if (violation(p, start, checkCap) !== 0) continue;
    } else start = greedy(p, checkCap, rand);
    if (start) consider(localSearch(p, start, checkCap, deadline));
  }
  return best;
}

// ---------------------------------------------------------------------------------------------

// Within one stop at a place: unload first (frees space), then load, when that stays valid.
function tidyRuns(p: Problem, order: number[], checkCap: boolean): number[] {
  let out = [...order];
  for (const [s, e] of runs(p, out)) {
    const run = out.slice(s, e);
    const sorted = [...run.filter((i) => p.delta[i] < 0), ...run.filter((i) => p.delta[i] >= 0)];
    const candidate = out.slice(0, s).concat(sorted, out.slice(e));
    if (violation(p, candidate, checkCap) === 0) out = candidate;
  }
  return out;
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

function routeMinutes(p: Problem, order: number[]): number {
  if (order.length === 0) return 0;
  let mins = travelOf(p, order) + order.length * HANDLING_MINUTES_PER_STOP;
  if (!p.startKnown) mins += UNKNOWN_TRAVEL_MINUTES;
  return Math.max(15, mins);
}

function routeGm(stops: Stop[], startLocation: string): number {
  let gm = 0;
  let prev = startLocation;
  for (const s of stops) {
    if (prev) gm += distanceGm(prev, s.location) ?? 0;
    prev = s.location;
  }
  return gm;
}

export type SolveResult = { order: number[]; optimal: boolean };

// Order the stops for the least total time. Exported for tests and the benchmark.
export function solveOrder(stops: Stop[], startLocation: string, shipScu: number, seedKey = ""): SolveResult {
  if (stops.length === 0) return { order: [], optimal: true };
  // Respect the hold when possible; if no order fits (one mission is bigger than the ship), plan
  // without the capacity rule and the route view flags the peak in red.
  for (const checkCap of [true, false]) {
    const p = buildProblem(stops, startLocation, shipScu);
    if (p.n <= EXACT_MAX_STOPS && p.places.length < 256) {
      const o = solveExact(p, checkCap);
      if (o) return { order: tidyRuns(p, o, checkCap), optimal: true };
    } else {
      const o = solveHeuristic(p, checkCap, hashString(seedKey));
      if (o) return { order: tidyRuns(p, o, checkCap), optimal: false };
    }
  }
  // Pickups and dropoffs that never balance (e.g. an OCR slip): keep the entry order.
  return { order: stops.map((_, i) => i), optimal: false };
}

const cache = new Map<string, PlannedRoute>();

export function planRoute(missions: Mission[], ship: Ship, currentLocation: string = ""): PlannedRoute {
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
        ...(leg.scuEstimated ? { scuEstimated: true } : {}),
      });
    }
  }

  if (baseStops.length === 0) {
    return { stops: [], totalReward, totalScu, peakScu: 0, auecPerHour: 0, distanceScore: 0, estimatedMinutes: 0 };
  }

  // Every panel plans the same route; compute it once per input.
  const cacheKey = JSON.stringify([baseStops, ship.scu, currentLocation, totalReward]);
  const hit = cache.get(cacheKey);
  if (hit) return hit;

  const seedKey = missions.map((m) => m.id).join("|") + "|" + currentLocation;
  const { order, optimal } = solveOrder(baseStops, currentLocation, ship.scu, seedKey);
  const best = order.map((i) => baseStops[i]);

  let cargo = 0;
  const stopsWithCargo = best.map((s) => {
    cargo += s.type === "pickup" ? s.scu : -s.scu;
    return { ...s, cargoAfter: Math.max(0, cargo) };
  });

  const p = buildProblem(baseStops, currentLocation, ship.scu);
  const estimatedMinutes = routeMinutes(p, order);
  const result: PlannedRoute = {
    stops: stopsWithCargo,
    totalReward,
    totalScu,
    peakScu: peakCargo(best),
    auecPerHour: (totalReward / estimatedMinutes) * 60,
    distanceScore: routeGm(best, currentLocation),
    estimatedMinutes,
    optimal,
  };
  if (cache.size > 50) cache.clear();
  cache.set(cacheKey, result);
  return result;
}

// Exposed for tests: total minutes of a given stop order under the planner's model.
export function orderMinutes(stops: Stop[], startLocation: string, order: number[]): number {
  return routeMinutes(buildProblem(stops, startLocation, Infinity), order);
}
export function orderValid(stops: Stop[], order: number[], shipScu: number): boolean {
  return violation(buildProblem(stops, "", shipScu), order, true) === 0;
}
