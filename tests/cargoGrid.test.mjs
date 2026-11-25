import { fillHold, fitLayout, actualLayout, cellAt, cellPosition } from "../lib/packer.ts";
import assert from "node:assert/strict";

// One cell per SCU
let h = fillHold([], 174);
assert.equal(h.cells.length, 174);
assert.equal(h.used, 0);

// Boxes fill consecutive cells; first delivery ends up nearest the door (highest index)
h = fillHold(
  [
    { missionId: "early", deliverOrder: 1, boxes: [{ size: 8, count: 9 }, { size: 4, count: 1 }] },
    { missionId: "late", deliverOrder: 2, boxes: [{ size: 16, count: 2 }, { size: 1, count: 1 }] },
  ],
  174
);
assert.equal(h.used, 76 + 33);
assert.equal(h.overflow, 0);
assert.equal(h.cells[0].missionId, "late");
assert.equal(h.cells[0].boxSize, 16);
assert.equal(h.cells[32].boxSize, 1);
assert.equal(h.cells[33].missionId, "early");
assert.equal(h.cells[108].missionId, "early");
assert.equal(h.cells[108].boxSize, 4);
assert.equal(h.cells[109], null);
assert.equal(h.cells.filter(Boolean).length, 109);

// Overflow is reported, never drawn outside the hold
h = fillHold([{ missionId: "x", deliverOrder: 1, boxes: [{ size: 32, count: 3 }] }], 64);
assert.equal(h.used, 64);
assert.equal(h.overflow, 32);

// Fit to window: everything visible, no scrolling, for every ship size
for (const [n, w, hgt] of [[8, 400, 500], [174, 400, 500], [4608, 420, 500], [12288, 300, 400], [4608, 1200, 300]]) {
  const l = fitLayout(n, w, hgt);
  assert.ok(l.rows * l.cols >= n, `cells ${n}`);
  assert.ok(l.width <= w + 1e-6, `width ${n}: ${l.width} > ${w}`);
  assert.ok(l.height <= hgt + 1e-6, `height ${n}: ${l.height} > ${hgt}`);
  assert.ok(l.cell > 0);
}
// Small ships keep readable squares (capped at 24 px)
assert.equal(fitLayout(8, 400, 500).cell, 24);
// Hull C in a typical side panel still gets > 5 px squares
assert.ok(fitLayout(4608, 420, 500).cell >= 5);

// Actual size: fixed squares, as wide as the panel allows, scrolls vertically
const a = actualLayout(4608, 420, 14);
assert.equal(a.cell, 14);
assert.ok(a.width <= 420);
assert.ok(a.rows * a.cols >= 4608);
assert.ok(a.height > 500);

// Hit testing matches drawing positions
const l = fitLayout(174, 400, 500);
for (const i of [0, 1, 50, 173]) {
  const p = cellPosition(i, l);
  assert.equal(cellAt(p.x + l.cell / 2, p.y + l.cell / 2, l, 174), i);
}
assert.equal(cellAt(-1, 0, l, 174), null);

console.log("ALL CARGO GRID TESTS PASSED");
