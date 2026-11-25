// Regression: one delivery fed from several pickup points.
// Up to 7342ef4 the app kept all three "Collect Carbon from …" lines (even split of the delivered
// SCU). From upstream d8e5e97/6fd1c4d the extra collects were dropped: only the first pickup was
// kept with the full amount, and "(8 SCU or smaller)" was not read as the max container.
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import {
  parseContractText as parse,
  pickConsensus,
  mergeReads,
  parseMaxContainerSize,
  evenSplit,
  applySuggestedPickups,
} from "../lib/parseContract.ts";
import { LOCATIONS } from "../lib/locations.ts";

const known = LOCATIONS.map((l) => l.name);
const fx = (n) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), "utf8");
const A = fx("ocr-carbon-pyro-A.txt");
const B = fx("ocr-carbon-pyro-B.txt");
const short = (r) => r.collects.map((c) => `${c.location}:${c.scu}`);

let n = 0;
const test = (name, fn) => {
  fn();
  n++;
  console.log("ok -", name);
};

test("evenSplit always adds up", () => {
  assert.deepEqual(evenSplit(129, 3), [43, 43, 43]);
  assert.deepEqual(evenSplit(252, 3), [84, 84, 84]);
  assert.deepEqual(evenSplit(130, 3), [44, 43, 43]);
  assert.deepEqual(evenSplit(5, 1), [5]);
});

test("max container: '(8 SCU or smaller)' and 'X SCU or smaller/less'", () => {
  assert.equal(parseMaxContainerSize("packed in containers (8 SCU or smaller)."), 8);
  assert.equal(parseMaxContainerSize("containers of 8 SCU or smaller"), 8);
  assert.equal(parseMaxContainerSize("cargo 16 SCU or less"), 16);
  assert.equal(parseMaxContainerSize("Deliver 0/129 SCU of Carbon"), undefined);
});

for (const [name, text, total, each] of [
  ["A", A, 129, 43],
  ["B", B, 252, 84],
]) {
  test(`screenshot ${name}: one read keeps all three pickups`, () => {
    const r = parse(text, known);
    assert.equal(r.reward, 745250);
    assert.equal(r.delivers.length, 1);
    assert.equal(r.delivers[0].location, "Ruin Station");
    assert.equal(r.delivers[0].scu, total);
    assert.equal(r.collects.length, 3, JSON.stringify(short(r)));
    assert.ok(r.collects.every((c) => c.scu === each && c.scuEstimated));
    assert.equal(r.collects.reduce((s, c) => s + c.scu, 0), total);
    assert.deepEqual(r.orphanCollects, []);
    assert.equal(r.complete, true, r.warnings.join("; "));
    assert.equal(r.maxContainerSize, 8);
    assert.equal(r.legs.filter((l) => l.type === "pickup").length, 3);
    assert.ok(r.legs.filter((l) => l.type === "pickup").every((l) => l.scuEstimated));
    assert.equal(r.notes.length, 1);
    // applySuggestedPickups must not lose them either
    assert.equal(applySuggestedPickups(r).collects.length, 3);
  });

  test(`screenshot ${name}: consensus over passes keeps all three pickups`, () => {
    const reads = [parse(text, known), parse(text, known), parse(text, known)];
    const c = pickConsensus(reads);
    assert.ok(c.chosen);
    assert.equal(c.chosen.collects.length, 3);
  });

  test(`screenshot ${name}: vote across passes keeps all three pickups`, () => {
    // pass 2 lost the last pickup line (glare); passes 1 and 3 read it -> still 2 votes each
    const lines = text.split("\n");
    const lastCollect = lines.findLastIndex((l) => /Collect Carbon/.test(l));
    const glare = lines.map((l, i) => (i === lastCollect ? l.replace(/© Collect Carbon from .*$/, "") : l)).join("\n");
    const reads = [parse(text, known), parse(glare, known), parse(text, known)];
    const m = mergeReads(reads);
    assert.ok(m.chosen, m.detail);
    assert.equal(m.chosen.complete, true, m.chosen.warnings.join("; "));
    assert.equal(m.chosen.collects.length, 3, JSON.stringify(short(m.chosen)));
    assert.equal(m.chosen.collects.reduce((s, c) => s + c.scu, 0), total);
    assert.equal(m.chosen.maxContainerSize, 8);
    assert.equal(m.chosen.reward, 745250);
  });
}

test("a pickup place seen in only one pass is not trusted", () => {
  const noOrb = A.replace("© Collect Carbon from Orbituary.", "");
  const m = mergeReads([parse(A, known), parse(noOrb, known), parse(noOrb, known)]);
  // two of three passes saw two pickups: Orbituary (one vote) is not added
  assert.ok(m.chosen, m.detail);
  assert.deepEqual(short(m.chosen), ["Starlight Service Station:65", "Gaslight:64"]);
});

test("pickup count agreed but a place read only once -> not complete", () => {
  const swap = A.replace("Orbituary", "Checkmate");
  const swap2 = A.replace("Orbituary", "Endgame");
  const m = mergeReads([parse(A, known), parse(swap, known), parse(swap2, known)]);
  assert.equal(m.chosen, null, m.detail);
});

test("a collect with no matching delivery is still an orphan", () => {
  const t = `Reward 10,000\n© Deliver 0/10 SCU of Carbon to Ruin Station above Pyro VI.\n© Collect Carbon from Gaslight.\n© Collect Iron from Orbituary.`;
  const r = parse(t, known);
  assert.deepEqual(r.orphanCollects, ["iron"]);
  assert.equal(r.complete, false);
});

console.log(`ALL ${n} OCR MULTI-COLLECT TESTS PASSED`);
