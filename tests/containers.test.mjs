import {
  boxBreakdown,
  formatBreakdown,
  breakdownTotal,
  mergeBreakdowns,
  resolveMaxContainer,
  largestAllowedContainer,
  splitIntoContainers,
  groupStopsWithBoxes,
} from "../lib/containers.ts";
import { isValidOrder } from "../lib/routeValidity.ts";
import assert from "node:assert/strict";

// Greedy split, largest allowed box first
assert.deepEqual(boxBreakdown(76, 8), [{ size: 8, count: 9 }, { size: 4, count: 1 }]);
assert.equal(formatBreakdown(boxBreakdown(76, 8)), "9×8 + 1×4");
assert.deepEqual(boxBreakdown(174, 32), [
  { size: 32, count: 5 },
  { size: 8, count: 1 },
  { size: 4, count: 1 },
  { size: 2, count: 1 },
]);
assert.deepEqual(boxBreakdown(1, 1), [{ size: 1, count: 1 }]);
assert.deepEqual(boxBreakdown(0, 8), []);
assert.equal(formatBreakdown(boxBreakdown(0, 8)), "—");
assert.deepEqual(boxBreakdown(33, 16), [{ size: 16, count: 2 }, { size: 1, count: 1 }]);
assert.equal(formatBreakdown(boxBreakdown(33, 16)), "2×16 + 1×1");

// Totals always add up, for every amount and max size
for (const max of [1, 2, 4, 8, 16, 24, 32]) {
  for (let scu = 0; scu <= 300; scu++) {
    const b = boxBreakdown(scu, max);
    assert.equal(breakdownTotal(b), scu, `${scu}@${max}`);
    assert.ok(b.every((x) => x.size <= max), `${scu}@${max} too big`);
  }
}

// Non-standard max sizes round down to a real box size
assert.equal(largestAllowedContainer(24), 16);
assert.equal(largestAllowedContainer(6), 4);
assert.deepEqual(boxBreakdown(40, 24), [{ size: 16, count: 2 }, { size: 8, count: 1 }]);

// Max container: mission value, else ship value (assumed), else 32 (assumed)
assert.deepEqual(resolveMaxContainer(8, 32), { size: 8, assumed: false });
assert.deepEqual(resolveMaxContainer(undefined, 16), { size: 16, assumed: true });
assert.deepEqual(resolveMaxContainer(undefined, undefined), { size: 32, assumed: true });
assert.deepEqual(resolveMaxContainer(0, 0), { size: 32, assumed: true });

// Old flat helper still works and now adds up exactly
assert.deepEqual(splitIntoContainers(76, 8), [8, 8, 8, 8, 8, 8, 8, 8, 8, 4]);
assert.deepEqual(splitIntoContainers(7, 8), [4, 2, 1]);

assert.deepEqual(
  mergeBreakdowns([{ size: 8, count: 2 }], [{ size: 8, count: 1 }, { size: 32, count: 1 }]),
  [{ size: 32, count: 1 }, { size: 8, count: 3 }]
);

// Stops: consecutive stops at the same place merge; split is per mission leg
const missions = [
  { id: "a", maxContainerSize: 8 },
  { id: "b", maxContainerSize: 16 },
  { id: "c" }, // unknown max -> ship max (assumed)
];
const stops = [
  { type: "pickup", location: "Port Tressler", scu: 76, missionId: "a", cargoAfter: 76 },
  { type: "pickup", location: "Port Tressler Station", scu: 33, missionId: "b", cargoAfter: 109 },
  { type: "pickup", location: "Everus Harbor", scu: 10, missionId: "c", cargoAfter: 119 },
  { type: "dropoff", location: "Everus Harbor", scu: 76, missionId: "a", cargoAfter: 43 },
  { type: "dropoff", location: "Baijini Point", scu: 33, missionId: "b", cargoAfter: 10 },
  { type: "dropoff", location: "Baijini Point", scu: 10, missionId: "c", cargoAfter: 0 },
];
const groups = groupStopsWithBoxes(stops, missions, 32);
assert.equal(groups.length, 4);
assert.equal(groups[0].scu, 109);
assert.deepEqual(groups[0].indices, [0, 1]);
assert.equal(formatBreakdown(groups[0].boxes), "2×16 + 9×8 + 1×4 + 1×1");
assert.equal(groups[0].perMission.length, 2);
assert.equal(formatBreakdown(groups[0].perMission[0].boxes), "9×8 + 1×4");
assert.equal(formatBreakdown(groups[0].perMission[1].boxes), "2×16 + 1×1");
assert.equal(groups[0].assumed, false);
assert.equal(groups[0].cargoAfter, 109);
assert.equal(groups[1].type, "pickup");
assert.equal(groups[1].assumed, true);
assert.equal(formatBreakdown(groups[1].boxes), "1×8 + 1×2");
assert.equal(groups[2].type, "dropoff");
assert.equal(groups[3].scu, 43);
assert.equal(formatBreakdown(groups[3].boxes), "2×16 + 1×8 + 1×2 + 1×1");

// Two legs of one mission at the same stop are split separately (boxes hold one commodity)
const g2 = groupStopsWithBoxes(
  [
    { type: "pickup", location: "X", scu: 3, missionId: "m", commodity: "stims" },
    { type: "pickup", location: "X", scu: 3, missionId: "m", commodity: "souvenirs" },
  ],
  [{ id: "m", maxContainerSize: 4 }]
);
assert.equal(g2.length, 1);
assert.equal(g2[0].perMission.length, 1);
assert.equal(formatBreakdown(g2[0].boxes), "2×2 + 2×1");
assert.deepEqual(g2[0].perMission[0].commodities, ["stims", "souvenirs"]);

// Grouping never reorders stops, so a route that passes routeValidity stays valid when shown
// grouped, and every stop is counted exactly once.
const flat = groups.flatMap((g) => g.stops);
assert.deepEqual(flat, stops);
assert.deepEqual(groups.flatMap((g) => g.indices), stops.map((_, i) => i));
assert.equal(isValidOrder(flat), isValidOrder(stops));
assert.equal(isValidOrder(stops), true);

console.log("ALL CONTAINER TESTS PASSED");
