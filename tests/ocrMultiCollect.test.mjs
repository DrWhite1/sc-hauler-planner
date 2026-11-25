// Regression: one delivery fed from several pickup points, on real OCR output of K's screenshots
// (see fixtures/README.md). Up to 7342ef4 the app kept all three "Collect Carbon from …" lines;
// from upstream d8e5e97/6fd1c4d it kept only the first pickup with the full amount, and
// "(8 SCU or smaller)" was not read as the max container.
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import {
  parseContractText,
  pickConsensus,
  mergeReads,
  scoreParse,
  parseMaxContainerSize,
  evenSplit,
  applySuggestedPickups,
  resolveAmbiguousNames,
} from "../lib/parseContract.ts";
import { LOCATIONS, systemOf, hasExternalPort } from "../lib/locations.ts";

const known = LOCATIONS.map((l) => l.name);
const opts = { systemOf };
const parse = (t) => parseContractText(t, known, opts);
const fx = (n) => JSON.parse(readFileSync(new URL(`./fixtures/${n}`, import.meta.url), "utf8"));
const short = (r) => r.collects.map((c) => `${c.location}:${c.scu}`);

// Desktop app, PaddleOCR path (MissionOCR.processImage): one read of header + objectives,
// added only if complete.
function paddlePipeline(raw) {
  return parse(`${raw.header ?? ""}\n${raw.objectives}`);
}

// tesseract.js path (MissionOCR.processImage): whole-image read, cropped passes until two reads
// agree, header pass for the reward, then consensus or the vote across passes.
function tesseractPipeline(raw) {
  let result = parse(raw.full);
  const reads = [result];
  for (const p of raw.passes) {
    const next = parse(p.text);
    if (!next.reward) next.reward = result.reward;
    if (!next.corporation) next.corporation = result.corporation;
    if (!next.suggestedPickup) next.suggestedPickup = result.suggestedPickup;
    reads.push(next);
    if (scoreParse(next) > scoreParse(result)) result = next;
    if (pickConsensus(reads).state === "agreed") break;
  }
  const h = parse(raw.header);
  for (const r of reads) {
    if (h.reward) r.reward = h.reward;
    if (h.corporation) r.corporation = h.corporation;
  }
  let consensus = pickConsensus(reads);
  if (consensus.state !== "agreed" && consensus.state !== "single") {
    const merged = mergeReads(reads);
    if (merged.chosen && merged.chosen.complete) consensus = { chosen: merged.chosen, state: "agreed" };
  }
  return { chosen: consensus.chosen ?? result, reads };
}

let n = 0;
const test = (name, fn) => {
  fn();
  n++;
  console.log("ok -", name);
};

const EXPECT = {
  A: { total: 129, each: 43, pickups: ["Starlight Service Station", "Gaslight", "Orbituary"] },
  B: { total: 252, each: 84, pickups: ["Stanton Gateway (Pyro)", "Megumi Refueling", "Rod's Fuel 'N Supplies"] },
};

function checkContract(r, e, label) {
  const why = `${label}: ${JSON.stringify({ c: short(r), w: r.warnings })}`;
  assert.equal(r.complete, true, why);
  assert.equal(r.reward, 745250, why);
  assert.equal(r.delivers.length, 1, why);
  assert.equal(r.delivers[0].commodity.toLowerCase(), "carbon", why);
  assert.equal(r.delivers[0].location, "Ruin Station", why);
  assert.equal(r.delivers[0].scu, e.total, why);
  assert.deepEqual(r.collects.map((c) => c.location), e.pickups, why);
  assert.ok(r.collects.every((c) => c.scu === e.each && c.scuEstimated), why);
  assert.equal(r.collects.reduce((s, c) => s + c.scu, 0), e.total, why);
  assert.equal(r.maxContainerSize, 8, why);
  assert.equal(r.legs.filter((l) => l.type === "pickup").length, 3, why);
}

test("evenSplit always adds up", () => {
  assert.deepEqual(evenSplit(129, 3), [43, 43, 43]);
  assert.deepEqual(evenSplit(252, 3), [84, 84, 84]);
  assert.deepEqual(evenSplit(130, 3), [44, 43, 43]);
  assert.deepEqual(evenSplit(5, 1), [5]);
});

test("max container: '(8 SCU or smaller)', also wrapped with other text in between", () => {
  assert.equal(parseMaxContainerSize("packed in containers (8 SCU or smaller)."), 8);
  assert.equal(parseMaxContainerSize("containers of 8 SCU or smaller"), 8);
  assert.equal(parseMaxContainerSize("cargo 16 SCU or less"), 16);
  assert.equal(parseMaxContainerSize("cargo (8 SCU or Collect Carbon from Gaslight. smaller) at a few"), 8);
  assert.equal(parseMaxContainerSize("cargo (8 SCU or . Pp smaller) at a few"), 8);
  assert.equal(parseMaxContainerSize("Deliver 0/129 SCU of Carbon"), undefined);
});

for (const k of ["A", "B"]) {
  const paddle = fx(`ocr-carbon-pyro-${k}.paddle.json`);
  const tess = fx(`ocr-carbon-pyro-${k}.tesseract.json`);

  test(`screenshot ${k}, PaddleOCR (real output): 3 pickups, max 8, reward 745,250`, () => {
    const r = paddlePipeline(paddle);
    checkContract(r, EXPECT[k], `paddle ${k}`);
    assert.equal(applySuggestedPickups(r).collects.length, 3);
  });

  test(`screenshot ${k}, tesseract (real output): 3 pickups, max 8, reward 745,250`, () => {
    const { chosen } = tesseractPipeline(tess);
    checkContract(chosen, EXPECT[k], `tesseract ${k}`);
  });

  test(`screenshot ${k}: vote across real passes keeps all three pickups`, () => {
    // Force the vote: the whole-image read, every recorded pass and the PaddleOCR read, with
    // the last pickup line lost to glare in one of them.
    const texts = [tess.full, ...tess.passes.map((p) => p.text), `${paddle.header}\n${paddle.objectives}`];
    const last = EXPECT[k].pickups[2].replace(/ \(.*\)$/, "");
    texts[1] = texts[1].replace(new RegExp(`Collect Carbon from ${last.replace(/'/g, ".")}.*`), "");
    const reads = texts.map(parse);
    for (const r of reads) if (!r.reward) r.reward = 745250;
    const m = mergeReads(reads);
    assert.ok(m.chosen, m.detail);
    checkContract(m.chosen, EXPECT[k], `merge ${k}`);
  });
}

test("a pickup place seen in only one pass is not trusted", () => {
  const p = fx("ocr-carbon-pyro-A.paddle.json");
  const t = `${p.header}\n${p.objectives}`;
  const noOrb = t.replace("Collect Carbon from Orbituary.", "");
  const m = mergeReads([parse(t), parse(noOrb), parse(noOrb)]);
  // two of three passes saw two pickups: Orbituary (one vote) is not added
  assert.ok(m.chosen, m.detail);
  assert.deepEqual(short(m.chosen), ["Starlight Service Station:65", "Gaslight:64"]);
});

test("pickup count agreed but a place read only once -> not added", () => {
  const p = fx("ocr-carbon-pyro-A.paddle.json");
  const t = `${p.header}\n${p.objectives}`;
  const m = mergeReads([
    parse(t),
    parse(t.replace("from Orbituary", "from Checkmate")),
    parse(t.replace("from Orbituary", "from Endgame")),
  ]);
  assert.equal(m.chosen, null, m.detail);
});

test("a collect with no matching delivery is still an orphan", () => {
  const r = parse(`Reward 10,000\n© Deliver 0/10 SCU of Carbon to Ruin Station above Pyro VI.\n© Collect Carbon from Gaslight.\n© Collect Iron from Orbituary.`);
  assert.deepEqual(r.orphanCollects, ["iron"]);
  assert.equal(r.complete, false);
});

test("gateways: a bare name is resolved from the system of the other locations", () => {
  const res = (names) => resolveAmbiguousNames(names, known, systemOf);
  // Pyro contract (K's screenshot B): Stanton Gateway is the one in Pyro, which has a cargo deck
  assert.deepEqual(res(["Ruin Station", "Stanton Gateway", "Megumi Refueling"]), [
    "Ruin Station",
    "Stanton Gateway (Pyro)",
    "Megumi Refueling",
  ]);
  assert.equal(hasExternalPort("Stanton Gateway (Pyro)"), true);
  // Nyx contract: Stanton Gateway (Nyx)
  assert.deepEqual(res(["Levski", "Stanton Gateway"]), ["Levski", "Stanton Gateway (Nyx)"]);
  // "Nyx Gateway" is the Stanton one in Stanton, the Pyro one in Pyro
  assert.deepEqual(res(["Nyx Gateway", "Checkmate"]), ["Nyx Gateway (Pyro)", "Checkmate"]);
  assert.deepEqual(res(["Nyx Gateway", "Everus Harbor"]), ["Nyx Gateway", "Everus Harbor"]);
  // no context or mixed systems: left as read
  assert.deepEqual(res(["Stanton Gateway"]), ["Stanton Gateway"]);
  assert.deepEqual(res(["Stanton Gateway", "Ruin Station", "Levski"]), ["Stanton Gateway", "Ruin Station", "Levski"]);
  // names that already say their system are not changed
  assert.deepEqual(res(["Stanton Gateway (Nyx)", "Ruin Station"]), ["Stanton Gateway (Nyx)", "Ruin Station"]);
  // without systemOf the parser keeps the bare name (old behaviour)
  const b = fx("ocr-carbon-pyro-B.paddle.json");
  const plain = parseContractText(`${b.header}\n${b.objectives}`, known);
  assert.equal(plain.collects[0].location, "Stanton Gateway");
});

console.log(`ALL ${n} OCR MULTI-COLLECT TESTS PASSED`);
