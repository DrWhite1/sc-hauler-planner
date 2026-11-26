// Route planner: fastest order under the planner's own travel model, never unloading cargo
// before it is loaded and never over the hold. Run: node --import ./tests/ts-resolve.mjs ...
import assert from "node:assert/strict";
import { planRoute, solveOrder, orderMinutes, orderValid, EXACT_MAX_STOPS } from "../lib/optimizer.ts";
import { travelMinutes, distanceGm, DOCK_TO_DOCK_MINUTES, UNKNOWN_TRAVEL_MINUTES } from "../lib/travel.ts";
import { isValidOrder } from "../lib/routeValidity.ts";
import { LOCATIONS } from "../lib/locations.ts";

let n = 0;
const test = (name, fn) => { fn(); n++; };
let seed = 42;
const R = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pyro = LOCATIONS.filter((l) => l.system === "Pyro").map((l) => l.name);
const stanton = LOCATIONS.filter((l) => !l.system).map((l) => l.name);

function peak(stops) { let c = 0, p = 0; for (const s of stops) { c += s.type === "pickup" ? s.scu : -s.scu; p = Math.max(p, c); } return p; }

function randomStops(count, places) {
  const stops = [];
  for (let k = 0; stops.length < count; k++) {
    const pick = () => places[Math.floor(R() * places.length)];
    const scu = 10 + Math.floor(R() * 90);
    const r = R();
    if (r < 0.35 && stops.length + 3 <= count) {
      stops.push({ type: "pickup", location: pick(), scu, missionId: "m" + k, commodity: "c" });
      stops.push({ type: "pickup", location: pick(), scu, missionId: "m" + k, commodity: "c" });
      stops.push({ type: "dropoff", location: pick(), scu: 2 * scu, missionId: "m" + k, commodity: "c" });
    } else if (r < 0.6 && stops.length + 3 <= count) {
      stops.push({ type: "pickup", location: pick(), scu: 2 * scu, missionId: "m" + k, commodity: "c" });
      stops.push({ type: "dropoff", location: pick(), scu, missionId: "m" + k, commodity: "c" });
      stops.push({ type: "dropoff", location: pick(), scu, missionId: "m" + k, commodity: "c" });
    } else if (stops.length + 2 <= count) {
      stops.push({ type: "pickup", location: pick(), scu, missionId: "m" + k, commodity: "c" });
      stops.push({ type: "dropoff", location: pick(), scu, missionId: "m" + k, commodity: "c" });
    } else break;
  }
  return stops;
}

function* permutations(a) {
  if (a.length <= 1) { yield a; return; }
  for (let i = 0; i < a.length; i++) for (const p of permutations([...a.slice(0, i), ...a.slice(i + 1)])) yield [a[i], ...p];
}

test("travel model uses measured distances", () => {
  assert.equal(distanceGm("Orbituary", "Starlight Service Station"), 2);
  assert.equal(distanceGm("Everus Harbor", "Seraphim Station"), 32);
  assert.equal(distanceGm("Port Tressler above microTech", "MIC-L1 Shallow Frontier Station"), 4);
  assert.equal(travelMinutes("Ruin Station", "Ruin Station above Pyro VI"), 0);
  assert.equal(travelMinutes("Somewhere Odd", "Ruin Station"), UNKNOWN_TRAVEL_MINUTES);
  // near places are quick, far ones slow
  assert.ok(travelMinutes("Orbituary", "Starlight Service Station") < DOCK_TO_DOCK_MINUTES + 1);
  assert.ok(travelMinutes("Ruin Station", "Endgame") > travelMinutes("Orbituary", "Starlight Service Station") + 10);
  // other systems go through the gateways and the jump
  const cross = travelMinutes("Everus Harbor", "Ruin Station");
  assert.ok(cross > travelMinutes("Everus Harbor", "Pyro Gateway") + travelMinutes("Stanton Gateway (Pyro)", "Ruin Station") - 2 * DOCK_TO_DOCK_MINUTES);
  assert.equal(distanceGm("Everus Harbor", "Ruin Station"), distanceGm("Everus Harbor", "Pyro Gateway") + distanceGm("Stanton Gateway (Pyro)", "Ruin Station"));
});

test("matches brute force on small cases (every valid order tried)", () => {
  for (let t = 0; t < 120; t++) {
    const places = R() < 0.5 ? pyro : stanton;
    const stops = randomStops(4 + Math.floor(R() * 4), places);
    const total = stops.filter((s) => s.type === "pickup").reduce((a, s) => a + s.scu, 0);
    const cap = R() < 0.5 ? Math.max(...stops.map((s) => s.scu)) + Math.floor(R() * total / 2) : total;
    const start = R() < 0.8 ? places[Math.floor(R() * places.length)] : "";
    // independent check: own cost and validity, straight from travelMinutes and isValidOrder
    const T = (a, b) => (a === b ? 0 : !a ? UNKNOWN_TRAVEL_MINUTES : travelMinutes(a, b));
    let best = Infinity;
    for (const perm of permutations(stops.map((_, i) => i))) {
      const ordered = perm.map((i) => stops[i]);
      if (peak(ordered) > cap || !isValidOrder(ordered)) continue;
      let m = 0, prev = start;
      for (const s of ordered) { m += T(prev, s.location); prev = s.location; }
      best = Math.min(best, Math.max(15, m + 3 * ordered.length));
    }
    const { order, optimal } = solveOrder(stops, start, cap);
    if (best === Infinity) continue; // no order fits the hold; covered below
    assert.ok(optimal);
    assert.ok(orderValid(stops, order, cap), "valid");
    assert.ok(Math.abs(orderMinutes(stops, start, order) - best) < 1e-3, `case ${t}: ${orderMinutes(stops, start, order)} vs ${best}`);
  }
});

test("longer lists: always valid and within the hold, deterministic", () => {
  for (let t = 0; t < 25; t++) {
    const places = R() < 0.5 ? pyro : stanton;
    const stops = randomStops(EXACT_MAX_STOPS + 1 + Math.floor(R() * 8), places);
    const total = stops.filter((s) => s.type === "pickup").reduce((a, s) => a + s.scu, 0);
    const cap = Math.max(...stops.map((s) => s.scu), Math.round(total * 0.6));
    const a = solveOrder(stops, places[0], cap, "k" + t);
    const b = solveOrder(stops, places[0], cap, "k" + t);
    assert.deepEqual(a.order, b.order);
    assert.equal(new Set(a.order).size, stops.length);
    const ordered = a.order.map((i) => stops[i]);
    assert.ok(isValidOrder(ordered));
    assert.ok(peak(ordered) <= cap);
  }
});

const P = (loc, scu) => ({ type: "pickup", location: loc, scu, commodity: "Carbon" });
const D = (loc, scu) => ({ type: "dropoff", location: loc, scu, commodity: "Carbon" });
const ironclad = { id: "ironclad", name: "Ironclad", scu: 2200, maxContainer: 32 };

test("K's Pyro Carbon contracts: all pickups, near ones together, then Ruin", () => {
  const missions = [
    { id: "A", pickup: "", dropoff: "", reward: 745250, scu: 129, legs: [P("Starlight Service Station", 43), P("Gaslight", 43), P("Orbituary", 43), D("Ruin Station", 129)] },
    { id: "B", pickup: "", dropoff: "", reward: 745250, scu: 252, legs: [P("Stanton Gateway (Pyro)", 84), P("Megumi Refueling", 84), P("Rod's Fuel 'N Supplies", 84), D("Ruin Station", 252)] },
  ];
  const r = planRoute(missions, ironclad, "Ruin Station");
  assert.equal(r.optimal, true);
  assert.equal(r.stops.length, 8);
  assert.deepEqual(r.stops.slice(-2).map((s) => s.location), ["Ruin Station", "Ruin Station"]);
  const locs = r.stops.map((s) => s.location);
  assert.equal(Math.abs(locs.indexOf("Orbituary") - locs.indexOf("Starlight Service Station")), 1); // 2 Gm apart
  assert.ok(isValidOrder(r.stops));
  // the order the old planner picked for this run is slower under the same model
  const old = ["Starlight Service Station", "Gaslight", "Rod's Fuel 'N Supplies", "Megumi Refueling", "Orbituary", "Stanton Gateway (Pyro)", "Ruin Station", "Ruin Station"];
  const stops = missions.flatMap((m) => m.legs.map((l) => ({ ...l, missionId: m.id })));
  const oldOrder = [0, 1, 6, 5, 2, 4, 3, 7]; // indices into stops (A then B legs)
  assert.deepEqual(oldOrder.map((i) => stops[i].location), old);
  assert.ok(orderMinutes(stops, "Ruin Station", oldOrder) > r.estimatedMinutes + 10);
});

test("unloads before loading at the same place, and respects the hold", () => {
  const missions = [
    { id: "a", pickup: "", dropoff: "", reward: 1, scu: 60, legs: [P("Everus Harbor", 60), D("Seraphim Station", 60)] },
    { id: "b", pickup: "", dropoff: "", reward: 1, scu: 60, legs: [{ ...P("Seraphim Station", 60), commodity: "Gold" }, { ...D("Port Tressler", 60), commodity: "Gold" }] },
  ];
  const r = planRoute(missions, { id: "s", name: "s", scu: 64, maxContainer: 16 }, "Everus Harbor");
  assert.deepEqual(r.stops.map((s) => `${s.type}:${s.location}`), ["pickup:Everus Harbor", "dropoff:Seraphim Station", "pickup:Seraphim Station", "dropoff:Port Tressler"]);
  assert.equal(r.peakScu, 60);
});

test("a mission bigger than the ship still gets a loadable order (peak flagged in the UI)", () => {
  const missions = [{ id: "a", pickup: "", dropoff: "", reward: 1, scu: 100, legs: [P("Gaslight", 50), P("Checkmate", 50), D("Ruin Station", 100)] }];
  const r = planRoute(missions, { id: "s", name: "s", scu: 64, maxContainer: 16 }, "Ruin Station");
  assert.ok(isValidOrder(r.stops));
  assert.equal(r.stops[2].type, "dropoff");
  assert.ok(r.peakScu > 64);
});

console.log(`OPTIMIZER TESTS PASSED (${n})`);
