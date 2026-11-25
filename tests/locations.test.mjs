import { hasExternalPort, findLocation, LOCATIONS } from "../lib/locations.ts";
import assert from "node:assert/strict";

// Cargo-deck (EXT) locations, 4.10.3
for (const name of [
  "Ruin Station", "Checkmate", "Orbituary", "Gaslight", "Megumi Refueling",
  "Everus Harbor", "Port Tressler", "Seraphim Station", "Magnus Gateway",
  "Pyro Gateway", "Nyx Gateway", "Terra Gateway", "Stanton Gateway (Pyro)", "Levski",
]) {
  assert.equal(hasExternalPort(name), true, name);
}
for (const name of ["Baijini Point", "Security Post Kareah", "Sakura Sun Goldenrod Workcenter", "MIC-L5 Modern Icarus", "Patch City", "Nyx Gateway (Pyro)", "Lorville", "Grim HEX"]) {
  assert.equal(hasExternalPort(name), false, name);
}

// Names as they come out of contracts / OCR
assert.equal(hasExternalPort("Port Tressler above microTech"), true);
assert.equal(hasExternalPort("Checkmate Station"), true);
assert.equal(hasExternalPort("Everus Harbor above Hurston"), true);
assert.equal(hasExternalPort("Pyro Gateway (Stanton)"), true);
assert.equal(hasExternalPort("Seraphim"), true); // "Seraphim Station" without "Station"
assert.equal(hasExternalPort("Sacren's Plot"), false); // unknown place stays unflagged
assert.equal(hasExternalPort(""), false);
assert.equal(hasExternalPort("Port Tressler + Everus Harbor"), true);
assert.equal(hasExternalPort("Port Tressler + MIC-L5 Modern Icarus"), false);
assert.equal(findLocation("ruin station")?.name, "Ruin Station");

// No duplicate names
assert.equal(new Set(LOCATIONS.map((l) => l.name)).size, LOCATIONS.length);
console.log("ALL LOCATION TESTS PASSED");
