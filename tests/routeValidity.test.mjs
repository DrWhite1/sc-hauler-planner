import { isValidOrder } from "../lib/routeValidity.ts";
import assert from "node:assert/strict";

const p = (scu, commodity, missionId = "m") => ({ type: "pickup", scu, commodity, missionId });
const d = (scu, commodity, missionId = "m") => ({ type: "dropoff", scu, commodity, missionId });

// Covalex contract: all pickups before the deliveries is valid
assert.equal(isValidOrder([p(3, "waste"), p(3, "scrap"), p(2, "waste"), p(2, "scrap"), d(2, "waste"), d(3, "waste"), d(2, "scrap"), d(3, "scrap")]), true);
// delivering before the CRU-L5 cargo is loaded is not (the reported bug)
assert.equal(isValidOrder([p(3, "waste"), p(3, "scrap"), d(2, "waste"), d(3, "waste"), d(2, "scrap"), d(3, "scrap"), p(2, "waste"), p(2, "scrap")]), false);
// a delivery of more than is on board is invalid
assert.equal(isValidOrder([p(2, "waste"), d(3, "waste")]), false);
// interleaved but covered is valid
assert.equal(isValidOrder([p(2, "waste"), d(2, "waste"), p(3, "waste"), d(3, "waste")]), true);
// missions are independent
assert.equal(isValidOrder([p(5, "x", "a"), d(5, "x", "b")]), false);
// commodity name mismatch (OCR slip) falls back to mission totals
assert.equal(isValidOrder([p(2, "waste"), p(3, "scrap"), d(5, "wastee")]), true);
assert.equal(isValidOrder([d(5, "wastee"), p(2, "waste"), p(3, "scrap")]), false);
// missing commodity on legs: totals
assert.equal(isValidOrder([p(2), p(3), d(5)]), true);
console.log("ROUTE TESTS PASSED");
