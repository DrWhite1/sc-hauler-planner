// Regression (K, 27 Nov): a Red Wind "Member Hauler Needed for Medium Shipment" contract
// (collect potassium from two places, deliver to Ruin Station) came out as
// "Collect ~102 SCU potassium from Ruin Station", so the route had a pickup at the drop-off.
// The briefing column is read between the objective lines, and its sentence
// "...taken over to a freight elevator at Ruin Station above Pyro VI." landed right after a
// "Collect ... from" line whose place was wrapped or not in the location list. The parser
// looked for any known place in the next 80 characters and took Ruin Station from that prose.
// The objectives text below follows the line order of K's real PaddleOCR reads
// (tests/fixtures/ocr-carbon-pyro-A.paddle.json); the exact text of that scan was not kept.
import assert from "node:assert/strict";
import { parseContractText } from "../lib/parseContract.ts";
import { planRoute } from "../lib/optimizer.ts";
import { LOCATIONS, systemOf } from "../lib/locations.ts";

const known = LOCATIONS.map((l) => l.name);
const parse = (t) => parseContractText(t, known, { systemOf });
let n = 0;
const test = (name, fn) => {
  fn();
  n++;
  console.log("ok -", name);
};

const HEADER = `MARK ALL READ OFFERS ACCEPTED(4/10) HISTORY REACHING
Reward ¤ 532,500
Member Hauler Needed for Medium Shipment
HAULING - STELLAR Contract Deadline N/A
Contracted By Red Wind Linehaul
MEMBER HAULER NEEDED FOR
MEDIUM SHIPMENT 532k`;

const objectives = (secondCollect, afterLines) => `MEDIUM SHIPMENT 532k
RED WIND LINEHAUL DETAILS PRIMARY OBJECTIVES
RED WIND LINEHAUL Deliver 0/205 SCU of Potassium to Ruin Station above Pyro
MEMBER HAULER NEEDED FOR YOUR GOODS IN GOOD HANDS VI.
MEDIUM SHIPMENT 532k
RED WIND LINEHAUL Collect Potassium from Megumi Refueling.
Just got off a comm with a client. They got cargo (8 SCU or
smaller) at a few different locations ready to be taken over to a
${secondCollect}
freight elevator at Ruin Station above Pyro Vl.
${afterLines}
PICK UP LOCATIONS(ANY ORDER)
- Freight elevator at Megumi Refueling at the L5 Lagrange of Pyro IV
I'd recommend taking a few minutes to plan your route before
taking off. Might save you a bit of fuel.`;

const pickups = (r) => r.collects.map((c) => c.location);

test("wrapped place name: 'Starlight Service' / 'Station.' is read as Starlight Service Station", () => {
  const r = parse(`${HEADER}\n${objectives("Collect Potassium from Starlight Service", "Station.")}`);
  assert.deepEqual(r.delivers.map((d) => d.location), ["Ruin Station"]);
  assert.deepEqual(pickups(r), ["Megumi Refueling", "Starlight Service Station"]);
  assert.ok(r.complete, r.warnings.join("; "));
});

test("place not in the location list is kept as read, not replaced by Ruin Station from the prose", () => {
  const r = parse(`${HEADER}\n${objectives("Collect Potassium from Rat's Nest.", "")}`);
  assert.deepEqual(pickups(r), ["Megumi Refueling", "Rat's Nest"]);
});

test("unreadable place: no pickup at the drop-off, the contract is not complete", () => {
  const r = parse(`${HEADER}\n${objectives("Collect Potassium from Xq@ 7%", "")}`);
  assert.ok(!pickups(r).includes("Ruin Station"), pickups(r).join(", "));
  assert.equal(r.complete, false);
});

test("a pickup of a commodity at the place it is delivered to is rejected", () => {
  // Even if the text really says it, collecting and delivering the same cargo at one place is
  // not a hauling contract, so it must be a misread.
  const r = parse(`${HEADER}
RED WIND LINEHAUL Deliver 0/205 SCU of Potassium to Ruin Station above Pyro VI.
Collect Potassium from Megumi Refueling.
Collect Potassium from Ruin Station.`);
  assert.ok(!pickups(r).includes("Ruin Station"), pickups(r).join(", "));
  assert.equal(r.complete, false);
  assert.ok(r.warnings.some((w) => /drop-off/.test(w)), r.warnings.join("; "));
});

test("collect contracts still deliver to Ruin Station: one final stop there, no pickup there", () => {
  // K's four missions (from his saved app state) with the potassium contract read correctly.
  const ship = { id: "ironclad-assault", name: "Ironclad Assault", scu: 1440, maxContainer: 32 };
  const leg = (type, location, scu, commodity) => ({ type, location, scu, commodity, ...(type === "pickup" ? { scuEstimated: true } : {}) });
  const potassium = parse(`${HEADER}\n${objectives("Collect Potassium from Starlight Service", "Station.")}`);
  const missions = [
    { id: "m1", pickup: "", dropoff: "Ruin Station", reward: 745250, scu: 150, corporation: "Red Wind Linehaul", maxContainerSize: 8, addedAt: 1,
      legs: [leg("pickup", "Stanton Gateway (Pyro)", 50, "carbon"), leg("pickup", "Checkmate", 50, "carbon"), leg("pickup", "Megumi Refueling", 50, "carbon"), leg("dropoff", "Ruin Station", 150, "carbon")] },
    { id: "m2", pickup: "", dropoff: "Ruin Station", reward: 532500, scu: 154, corporation: "Red Wind Linehaul", maxContainerSize: 8, addedAt: 2,
      legs: [leg("pickup", "Stanton Gateway (Pyro)", 77, "carbon"), leg("pickup", "Rod's Fuel 'N Supplies", 77, "carbon"), leg("dropoff", "Ruin Station", 154, "carbon")] },
    { id: "m3", pickup: "", dropoff: "Ruin Station", reward: 745250, scu: 230, corporation: "Red Wind Linehaul", maxContainerSize: 8, addedAt: 3,
      legs: [leg("pickup", "Checkmate", 115, "carbon"), leg("pickup", "Patch City", 115, "carbon"), leg("dropoff", "Ruin Station", 230, "carbon")] },
    { id: "m4", pickup: potassium.pickup, dropoff: potassium.dropoff, reward: 532500, scu: 205, corporation: "Red Wind Linehaul", maxContainerSize: 8, addedAt: 4,
      legs: potassium.legs },
  ];
  const route = planRoute(missions, ship, "Ruin Station");
  const ruin = route.stops.map((s, i) => [s, i]).filter(([s]) => s.location === "Ruin Station");
  assert.ok(ruin.every(([s]) => s.type === "dropoff"), "no pickup at Ruin Station");
  const firstRuin = ruin[0][1];
  assert.ok(route.stops.slice(firstRuin).every((s) => s.location === "Ruin Station"), "Ruin Station only once, at the end");
});

test("the briefing's destination ('taken over to a freight elevator at Ruin Station') is not offered as pickup", () => {
  const r = parse(`${HEADER}\n${objectives("Collect Potassium from Starlight Service", "Station.")}`);
  assert.notEqual(r.suggestedPickup, "Ruin Station");
});

console.log(`ALL ${n} COLLECT/DROP-OFF TESTS PASSED`);
