import { parseContractText as parse, applySuggestedPickups, pickConsensus } from "../lib/parseContract.ts";
import { LOCATIONS } from "../lib/locations.ts";

const known = LOCATIONS.map((l) => l.name);
const parseContractText = (t) => parse(t, known);
import assert from "node:assert/strict";

// OCR output exactly as Jeroen pasted it (WhatsApp, 2026-11-25).
const t1 = `Reward x 52,500

H H Contract Availability 12m Ow
Red Wind Seeking New Haulers Contracted By Red Wind Linehaul
DETAILS PRIMARY OBJECTIVES
RED WIND LINEHAUL | © Deliver 0/6 SCU of Ship Ammunition to NB Int. Spaceport uf
"YOUR GOODS IN GOOD HANDS or mioEclscH.

© Collect Ship Ammunition from MIC-LS Modern Ical
Red Wind is looking to bolster our roster of haulers. Need Station.
someone who can keep their wits about them and keep quiet. If
you check those boxes, and have a ship that can handle 4 SCU
cargo containers, then give this trial run a shot.
PICK UP [
Freight elevator at Modern Icarus Station at microTech's LS |
Lagrange point.
DROP OFF |
Freight elevator at NB Int. Spaceport on microTech. |
Complete this contract and we'll send more hauling opportunities
your way. And don't forget to pack a handheld tractor beam to
bring along.
| ° ACCEPT OFFER`;

const t2 = `a
Reward © 476,500
H H n H H Contract Availability N/A
Cargo Hauling Opportunity with Ling Hauling a BIRT...
DETAILS PRIMARY OBJECTIVES
Hi, © Deliver 0/2 SCU of Souvenirs to Sacren's Plot on Pyro IV. |
This Is Petra Ling, and I'm proud to offer you a new and exciting © Collect Souvenirs from Brio's Breaker Yard.
opportunity to partner with Ling Family Hauling. When my parents
started this company, their goal was to provide fast and reliable © Deliver 0/1 SCU of Distilled Spirits to Sacren’s Plot on
courier deliveries around the greater Crusader arsa. It quickly Pyro IV.
— [IICORRe, and as our reputation grew, so did our © Collect Distilled Spirits from ArcCorp Mining
9 ArealS7.
Now, under my stewardship, Ling Family Hauling is taking the next "
big step - cargo hauling. Demand for this new service is growing < Deliver 0/4 SCU of Processed Food to Sacren's Plot on
faster than | expected, and that's great news for both of us. Pyro IV.
3 ¢ Collect Processed Food from Rayari Kaltag

If you've er be a hauler, then | can make your dreams

come rag: something is by doing it, and I've got Research Outpost.

a haul of Ite: ds to go from Brio's Breaker Yard on o

Daymar to Sacren's Plot on Pyro IV. < Deliver 0/2 SCU of Stims to Sacren's Plot on Pyro IV.

No prior experience is necessary, but here's a few things to keep Se Ea in EEE Dp.

in mind. All pick-ups and deliveries must be done at a freight

elevator or autoloaded. You will need a ship that can hold 2 SCU

cargo containers, and a handheld tractor beam to move them

around.

Upon successful completion of this delivery, you will be promoted

to a ‘trusted contractor’ status and more hauls will become \\

at
{ ° ACCEPT OFFER`;

// Same contract if the Stims line had been read.
const t2full = t2.replace("Se Ea in EEE Dp.", "Collect Stims from HDMS-Oparei.");

let r = parseContractText(t1);
console.log("T1", JSON.stringify({ reward: r.reward, corp: r.corporation, scu: r.totalScu, pickup: r.pickup, dropoff: r.dropoff, complete: r.complete }));
assert.equal(r.reward, 52500);
assert.equal(r.corporation, "Red Wind Linehaul");
assert.equal(r.totalScu, 6);
assert.equal(r.pickup, "MIC-L5 Modern Icarus");
assert.equal(r.dropoff, "NB Int. Spaceport");
assert.equal(r.complete, true);
assert.equal(r.collects[0].scu, 6);

r = parseContractText(t2);
console.log("T2 (as pasted)", JSON.stringify({ reward: r.reward, scu: r.totalScu, pickup: r.pickup, dropoff: r.dropoff, collects: r.collects, delivers: r.delivers, missing: r.missingPickups, complete: r.complete }));
assert.equal(r.reward, 476500);
assert.equal(r.delivers.length, 4);
assert.deepEqual(r.delivers.map((d) => d.scu), [2, 1, 4, 2]);
assert.ok(r.delivers.every((d) => d.location === "Sacren's Plot"));
assert.equal(r.collects.length, 3);
assert.deepEqual(r.collects.map((c) => [c.location, c.scu]), [
  ["Brio's Breaker Yard", 2],
  ["ArcCorp Mining Area 157", 1],
  ["Rayari Kaitag Research Outpost", 4],
]);
assert.deepEqual(r.missingPickups, ["stims"]);
assert.equal(r.complete, false);

r = parseContractText(t2full);
console.log("T2 (Stims line readable)", JSON.stringify({ pickup: r.pickup, scu: r.totalScu, collects: r.collects.map((c) => [c.commodity, c.location, c.scu]), complete: r.complete }));
assert.equal(r.collects.length, 4);
assert.deepEqual(r.collects.map((c) => c.scu), [2, 1, 4, 2]);
assert.equal(r.collects[3].location, "HDMS-Oparei");
assert.equal(r.complete, true);
assert.equal(r.totalScu, 9);


// ---- Covalex "Junior Rank - Direct Medium Cargo Haul" (in-game contracts screen, 2026-11-25) ----
// NOTE: built from a desktop-Tesseract reproduction of Jeroen's screenshot, NOT from the app's own
// "Extracted text" box. Replace with the real in-app text when available.

// (a) Everything read, objectives column only.
const cov = `Reward 57,750
Contract Availability 1h 35m
Contracted By Covalex Independent Contractors
PRIMARY OBJECTIVES
Deliver 0/37 SCU of Aluminum to Seraphim Station above
Crusader.
Collect Aluminum from ARC-L2 Lively Pathway
Station.
Deliver 0/35 SCU of Tungsten to Seraphim Station above
Crusader.
Collect Tungsten from ARC-L2 Lively Pathway
Station.
Deliver 0/21 SCU of Corundum to Seraphim Station above
Crusader.
Collect Corundum from ARC-L2 Lively Pathway
Station.`;
r = parseContractText(cov);
console.log("COVALEX clean", JSON.stringify({ reward: r.reward, corp: r.corporation, scu: r.totalScu, pickup: r.pickup, dropoff: r.dropoff, scus: r.collects.map((c) => c.scu), complete: r.complete }));
assert.equal(r.reward, 57750);
assert.equal(r.corporation, "Covalex Independent Contractors");
assert.equal(r.totalScu, 93);
assert.equal(r.pickup, "ARC-L2 Lively Pathway");
assert.equal(r.dropoff, "Seraphim Station");
assert.deepEqual(r.collects.map((c) => c.scu), [37, 35, 21]);
assert.equal(r.complete, true);

// (b) What the app produced: left contract list interleaved into the sentences and the first
// Deliver line not read. Must NOT be added, and must not leak list titles into location names.
const covBad = `Reward 57,750
Contracted By Covalex Independent Contractors
JUNIOR RANK - DIRECT EXTRA SMALL 56k
Collect Aluminum from ARC-L2 Lively Pathway Station.
Deliver 0/35 SCU of Tungsten to Seraphim Station above
Crusader.
Collect Tungsten from ARC-L2 Lively Pathway JUNIOR RANK - DIRECT EXTRA SMALL 56k
Station.
Deliver 0/21 SCU of Corundum to Seraphim Station above Crusader.
Collect Corundum from ARC-L2 Lively Pathway MEMBER RANK - MEDIUM CARGO HAUL 81k Station.`;
r = parseContractText(covBad);
console.log("COVALEX bad", JSON.stringify({ pickup: r.pickup, dropoff: r.dropoff, orphan: r.orphanCollects, warnings: r.warnings, complete: r.complete }));
assert.equal(r.pickup, "ARC-L2 Lively Pathway");
assert.ok(!/RANK|56k|81k|Seraphim/i.test(r.pickup));
assert.deepEqual(r.orphanCollects, ["aluminum"]);
assert.equal(r.complete, false);

// (c) Collect lines unreadable (small text), DETAILS names the pickup: suggest it, apply only on request.
const covNoCollect = `Reward 57,750
Contracted By Covalex Independent Contractors
Hi, A freight elevator at Lively Pathway Station at ArcCorp's L2
Lagrange point has some cargo that needs to be delivered to a
freight elevator at Seraphim Station above Crusader.
PRIMARY OBJECTIVES
Deliver 0/37 SCU of Aluminum to Seraphim Station above
Deliver 0/35 SCU of Tungsten to Seraphim Station above
Deliver 0/21 SCU of Corundum to Seraphim Station above Crusader.`;
r = parseContractText(covNoCollect);
console.log("COVALEX no collects", JSON.stringify({ missing: r.missingPickups, suggested: r.suggestedPickup, complete: r.complete }));
assert.equal(r.complete, false);
assert.deepEqual(r.missingPickups, ["aluminum", "tungsten", "corundum"]);
assert.equal(r.suggestedPickup, "ARC-L2 Lively Pathway");
const r2 = applySuggestedPickups(r);
assert.equal(r2.complete, true);
assert.equal(r2.pickup, "ARC-L2 Lively Pathway");
assert.equal(r2.totalScu, 93);
assert.deepEqual(r2.collects.map((c) => c.scu), [37, 35, 21]);

// OCR slips: L-code letters, spelling of commodity between collect and deliver, "O/" for "0/".
r = parseContractText(`Reward 20,000
Deliver O/12 SCU of Tungsten to Seraphim Station.
Collect Tungsfen from ARC-LZ Lively Pathway Station.`);
assert.equal(r.pickup, "ARC-L2 Lively Pathway");
assert.equal(r.complete, true);

// Unknown location is flagged, never stored raw.
r = parseContractText(`Reward 20,000
Deliver 0/4 SCU of Gold to Seraphim Station.
Collect Gold from Nowhere Outpost.`);
assert.equal(r.complete, false);
assert.equal(r.pickup, "");
assert.ok(r.unknownLocations.length === 1);
// consensus voting: a single misread digit (4 read as 74) must not be accepted silently
{
  const mk = (n) => parse(`Deliver 0/${n} SCU of Agricium to Seraphim Station.\nCollect Agricium from Port Olisar.`, known);
  const a = mk(4), b = mk(74), c = mk(4);
  assert.equal(pickConsensus([a, c]).state, "agreed");
  assert.equal(pickConsensus([a, b]).state, "conflict");
  assert.equal(pickConsensus([a, b, c]).state, "agreed");
  assert.equal(pickConsensus([a]).state, "single");
  assert.equal(pickConsensus([]).state, "none");
}
console.log("ALL TESTS PASSED");
