import { parseContractText } from "../lib/parseContract.ts";
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
console.log("ALL TESTS PASSED");
