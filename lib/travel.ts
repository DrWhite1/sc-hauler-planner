// Travel time between two places, in minutes, for route planning and the aUEC/hr estimate.
//
// time = dock-to-dock overhead + quantum time for the distance (+ a jump when the systems differ)
//
// Distances come from UEX Corp's measured orbit distances (lib/distances.ts). Quantum time per Gm
// is from the Star Citizen Wiki item data for 4.10 (api.star-citizen.wiki, "Travel Time (10GM)"):
// stock drives take about 5.3-7.5 s/Gm (size 1), 6.5-8.4 s/Gm (size 2) and 8.7-11.1 s/Gm (size 3),
// and the time grows almost linearly with distance (e.g. Agni S3: 32 Gm 4:51, 57 Gm 8:38).
// 8 s/Gm is used as a middle value for cargo ships.
import { DISTANCES_GM } from "./distances";
import { findLocation, systemOf, type StarSystem } from "./locations";

export const QT_SECONDS_PER_GM = 8;
// Undock / take off, leave the armistice zone, calibrate and spool (4-10 s on 4.10 drives), drop out
// of quantum near the destination, hail and land. An estimate: no source times this as a whole.
export const DOCK_TO_DOCK_MINUTES = 5;
// Extra for a landing zone on a planet surface (atmosphere flight down and back up), estimate.
export const PLANET_SURFACE_MINUTES = 4;
// Jump tunnel: about 30 s to 1.5 min to fly through (4.x, community timings), plus tuning and
// lining up with the jump point next to the gateway station.
export const JUMP_MINUTES = 3;
// Unknown place (not in the location list, e.g. an OCR slip): the old flat estimate.
export const UNKNOWN_TRAVEL_MINUTES = 8;

const SURFACE = new Set(["Lorville", "Area18", "New Babbage", "Orison"]);

// Gateway station in system `from` that leads to system `to`.
const GATEWAY: Record<string, string> = {
  "Stanton>Pyro": "Pyro Gateway",
  "Stanton>Nyx": "Nyx Gateway",
  "Pyro>Stanton": "Stanton Gateway (Pyro)",
  "Pyro>Nyx": "Nyx Gateway (Pyro)",
  "Nyx>Stanton": "Stanton Gateway (Nyx)",
  "Nyx>Pyro": "Pyro Gateway (Nyx)",
};

const index = new Map<string, Map<string, number>>();
for (const [sys, t] of Object.entries(DISTANCES_GM)) {
  const n = t.names.length;
  const pos = new Map<string, number>();
  t.names.forEach((name, i) => pos.set(name, i));
  index.set(sys, pos);
  if (t.gm.length !== (n * (n - 1)) / 2) throw new Error(`distance table for ${sys} has the wrong size`);
}

function gmInSystem(sys: string, a: string, b: string): number | undefined {
  if (a === b) return 0;
  const t = DISTANCES_GM[sys];
  const pos = index.get(sys);
  if (!t || !pos) return undefined;
  let i = pos.get(a);
  let j = pos.get(b);
  if (i === undefined || j === undefined) return undefined;
  if (i > j) [i, j] = [j, i];
  const n = t.names.length;
  return t.gm[i * n - (i * (i + 1)) / 2 + (j - i - 1)];
}

// Known place name for a contract or list name, or undefined.
const canonicalCache = new Map<string, string | undefined>();
export function canonicalLocation(loc: string): string | undefined {
  if (!canonicalCache.has(loc)) canonicalCache.set(loc, findLocation(loc)?.name);
  return canonicalCache.get(loc);
}

function systemOfKnown(name: string): StarSystem {
  return systemOf(name) ?? "Stanton";
}

// Quantum distance in Gm between two known places (through the gateways for other systems).
export function distanceGm(from: string, to: string): number | undefined {
  const a = canonicalLocation(from);
  const b = canonicalLocation(to);
  if (!a || !b) return undefined;
  const sa = systemOfKnown(a);
  const sb = systemOfKnown(b);
  if (sa === sb) return gmInSystem(sa, a, b);
  const out = GATEWAY[`${sa}>${sb}`];
  const inn = GATEWAY[`${sb}>${sa}`];
  if (!out || !inn) return undefined;
  const d1 = gmInSystem(sa, a, out);
  const d2 = gmInSystem(sb, inn, b);
  return d1 === undefined || d2 === undefined ? undefined : d1 + d2;
}

export function travelMinutes(from: string, to: string): number {
  if (!from || !to) return UNKNOWN_TRAVEL_MINUTES;
  const a = canonicalLocation(from);
  const b = canonicalLocation(to);
  if (a && b && a === b) return 0;
  if (!a || !b) {
    const na = from.toLowerCase().trim();
    const nb = to.toLowerCase().trim();
    return na === nb ? 0 : UNKNOWN_TRAVEL_MINUTES;
  }
  const gm = distanceGm(a, b);
  if (gm === undefined) return UNKNOWN_TRAVEL_MINUTES;
  let mins = DOCK_TO_DOCK_MINUTES + (gm * QT_SECONDS_PER_GM) / 60;
  if (systemOfKnown(a) !== systemOfKnown(b)) mins += JUMP_MINUTES;
  if (SURFACE.has(a)) mins += PLANET_SURFACE_MINUTES / 2;
  if (SURFACE.has(b)) mins += PLANET_SURFACE_MINUTES / 2;
  return mins;
}
