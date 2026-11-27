// Mission Edit panel: place dropdowns per stop (K, 27 Nov: the game sometimes lists the same
// pickup twice, often Nyx Gateway, so the place must be fixable by hand).
import assert from "node:assert/strict";
import { LOCATIONS, locationOptions, SYSTEM_ORDER } from "../lib/locations.ts";
import { distanceGm } from "../lib/travel.ts";
import { setLegLocation, summarizeLegs, stopsWithoutPlace } from "../lib/missionEdit.ts";
import { parseContractText, onlyPlacesMissing, legsWithUnplaced } from "../lib/parseContract.ts";
import { planRoute } from "../lib/optimizer.ts";
import { systemOf } from "../lib/locations.ts";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("ok -", name); };
const ship = { id: "ironclad-assault", name: "Ironclad Assault", scu: 1440, maxContainer: 32 };

test("options: every known location once, grouped Stanton / Pyro / Nyx, alphabetical", () => {
  const { groups, extra } = locationOptions("Checkmate");
  assert.equal(extra, null);
  assert.deepEqual(groups.map((g) => g.system), SYSTEM_ORDER);
  const all = groups.flatMap((g) => g.options.map((o) => o.name));
  assert.equal(all.length, LOCATIONS.length);
  assert.deepEqual([...all].sort(), LOCATIONS.map((l) => l.name).sort());
  for (const g of groups) {
    const names = g.options.map((o) => o.name);
    assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" })));
    for (const name of names) assert.equal(systemOf(name), g.system, name);
  }
});

test("options include Nyx Gateway (Stanton side) and Nyx Gateway (Pyro)", () => {
  const { groups } = locationOptions();
  const by = Object.fromEntries(groups.map((g) => [g.system, g.options.map((o) => o.name)]));
  assert.ok(by.Stanton.includes("Nyx Gateway"));
  assert.ok(by.Pyro.includes("Nyx Gateway (Pyro)"));
});

test("a current value that is not in the list is kept as an extra option", () => {
  assert.equal(locationOptions("Rat's Nest").extra, "Rat's Nest");
  assert.equal(locationOptions("").extra, null);
});

test("the planner has a distance between every pair of options", () => {
  const names = LOCATIONS.map((l) => l.name);
  for (const a of names) for (const b of names) assert.notEqual(distanceGm(a, b), undefined, `${a} -> ${b}`);
});

const checkmateTwice = {
  id: "m3", pickup: "Checkmate + Patch City", dropoff: "Ruin Station", reward: 745250, scu: 230, addedAt: 1,
  legs: [
    { type: "pickup", location: "Checkmate", scu: 77, commodity: "carbon", scuEstimated: true },
    { type: "pickup", location: "Checkmate", scu: 77, commodity: "carbon", scuEstimated: true },
    { type: "pickup", location: "Patch City", scu: 76, commodity: "carbon", scuEstimated: true },
    { type: "dropoff", location: "Ruin Station", scu: 230, commodity: "carbon" },
  ],
};

test("changing a duplicated pickup updates the leg and the card summary; the route re-plans", () => {
  const before = planRoute([checkmateTwice], ship, "Ruin Station");
  assert.ok(!before.stops.some((s) => s.location === "Nyx Gateway (Pyro)"));
  const edited = summarizeLegs(setLegLocation(checkmateTwice, 1, "Nyx Gateway (Pyro)"));
  assert.equal(edited.legs[1].location, "Nyx Gateway (Pyro)");
  assert.equal(edited.legs[0].location, "Checkmate");
  assert.equal(checkmateTwice.legs[1].location, "Checkmate", "original not mutated");
  assert.equal(edited.pickup, "Checkmate + Nyx Gateway (Pyro) + Patch City");
  assert.equal(edited.dropoff, "Ruin Station");
  const after = planRoute([edited], ship, "Ruin Station");
  assert.ok(after.stops.some((s) => s.type === "pickup" && s.location === "Nyx Gateway (Pyro)"));
  assert.equal(after.stops.at(-1).location, "Ruin Station");
});

test("a misread pickup can be added with no place and filled in from the list", () => {
  const text = `Reward ¤ 532,500
Contracted By Red Wind Linehaul
Deliver 0/205 SCU of Potassium to Ruin Station above Pyro VI.
Collect Potassium from Megumi Refueling.
Collect Potassium from Ruin Station.`;
  const r = parseContractText(text, LOCATIONS.map((l) => l.name), { systemOf });
  assert.equal(r.complete, false);
  assert.ok(onlyPlacesMissing(r), r.warnings.join("; "));
  const legs = legsWithUnplaced(r);
  const mission = { id: "m4", pickup: r.pickup, dropoff: r.dropoff, reward: r.reward, scu: r.totalScu, addedAt: 1, legs };
  assert.deepEqual(stopsWithoutPlace(mission), [1]);
  const fixed = summarizeLegs(setLegLocation(mission, 1, "Starlight Service Station"));
  assert.deepEqual(stopsWithoutPlace(fixed), []);
  assert.equal(fixed.pickup, "Megumi Refueling + Starlight Service Station");
  const route = planRoute([fixed], ship, "Ruin Station");
  assert.deepEqual(route.stops.map((s) => s.location).sort(), ["Megumi Refueling", "Ruin Station", "Starlight Service Station"]);
});

test("a read with an unreadable line is not offered for adding with missing places", () => {
  const r = parseContractText(`Reward ¤ 532,500
Deliver 0/205 SCU of Potassium to Ruin Station above Pyro VI.
Collect Potassium from Megumi Refueling.
Collect`, LOCATIONS.map((l) => l.name), { systemOf });
  assert.equal(onlyPlacesMissing(r), false);
});

console.log(`ALL ${n} MISSION EDIT TESTS PASSED`);
