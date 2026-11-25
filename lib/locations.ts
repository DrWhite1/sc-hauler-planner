export type Location = {
  name: string;
  // true = the location has a station cargo deck / loading dock with external freight
  // elevators, so ships that cannot enter a hangar (e.g. Hull C) can load there ("EXT").
  // Checked against UEX Corp (has_loading_dock) and community sources for 4.10.3, Nov 2026.
  externalPort: boolean;
  system?: StarSystem; // defaults to Stanton
};

export type StarSystem = "Stanton" | "Pyro" | "Nyx";

export const LOCATIONS: Location[] = [
  // Stanton - Main stations (Everus, Tressler and Seraphim have cargo decks)
  { name: "Everus Harbor", externalPort: true },
  { name: "Port Tressler", externalPort: true },
  { name: "Seraphim Station", externalPort: true },
  { name: "Baijini Point", externalPort: false }, // verified in game: no cargo deck
  { name: "Port Olisar", externalPort: false },
  { name: "Grim HEX", externalPort: false },

  // Stanton - Cities (surface, hangar only)
  { name: "Lorville", externalPort: false },
  { name: "Area18", externalPort: false },
  { name: "New Babbage", externalPort: false },
  { name: "Orison", externalPort: false },

  // Stanton - Lagrange stations (no external freight elevators)
  { name: "ARC-L1 Wide Forest", externalPort: false },
  { name: "ARC-L2 Lively Pathway", externalPort: false },
  { name: "ARC-L3 Modern Express", externalPort: false },
  { name: "ARC-L4 Faint Glen", externalPort: false },
  { name: "ARC-L5 Yellow Core", externalPort: false },
  { name: "CRU-L1 Ambitious Dream", externalPort: false },
  { name: "CRU-L4 Shallow Fields", externalPort: false },
  { name: "CRU-L5 Beautiful Glen", externalPort: false },
  { name: "HUR-L1 Green Glade", externalPort: false },
  { name: "HUR-L2 Faithful Dream", externalPort: false },
  { name: "HUR-L3 Thundering Express", externalPort: false },
  { name: "HUR-L4 Melodic Fields", externalPort: false },
  { name: "HUR-L5 High Course", externalPort: false },
  { name: "MIC-L1 Shallow Frontier", externalPort: false },
  { name: "MIC-L2 Long Forest", externalPort: false },
  { name: "MIC-L3 Endless Odyssey", externalPort: false },
  { name: "MIC-L4 Red Crossroads", externalPort: false },
  { name: "MIC-L5 Modern Icarus", externalPort: false },

  // Gateways (the Stanton-side gateways and Stanton Gateway in Pyro have cargo decks)
  { name: "Pyro Gateway", externalPort: true },
  { name: "Nyx Gateway", externalPort: true },
  { name: "Terra Gateway", externalPort: true },
  { name: "Magnus Gateway", externalPort: true }, // verified in game
  { name: "Stanton Gateway (Pyro)", externalPort: true, system: "Pyro" },
  { name: "Nyx Gateway (Pyro)", externalPort: false, system: "Pyro" },
  { name: "Stanton Gateway (Nyx)", externalPort: false, system: "Nyx" },

  // Pyro stations (Ruin, Checkmate, Orbituary, Gaslight and Megumi have cargo decks)
  { name: "Ruin Station", externalPort: true, system: "Pyro" },
  { name: "Checkmate", externalPort: true, system: "Pyro" },
  { name: "Orbituary", externalPort: true, system: "Pyro" },
  { name: "Gaslight", externalPort: true, system: "Pyro" },
  { name: "Starlight Service Station", externalPort: false, system: "Pyro" },
  { name: "Dudley & Daughters", externalPort: false, system: "Pyro" },
  { name: "Patch City", externalPort: false, system: "Pyro" },
  { name: "Megumi Refueling", externalPort: true, system: "Pyro" },
  { name: "Endgame", externalPort: false, system: "Pyro" },
  { name: "Rod's Fuel 'N Supplies", externalPort: false, system: "Pyro" },

  // Other
  { name: "Levski", externalPort: true, system: "Nyx" },
  { name: "Security Post Kareah", externalPort: false },
];

// Contract text names places in several ways ("Port Tressler above microTech",
// "Checkmate Station", "Pyro Gateway (Stanton)"), so compare a normalized form.
export function normalizeLocationName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+(?:above|on|at)\s.*$/, "")
    .replace(/\s+station$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Alternative names for the same place that the normalizer alone does not catch.
const EXTRA_NAMES: Record<string, string> = {
  "pyro gateway (stanton)": "Pyro Gateway",
  "nyx gateway (stanton)": "Nyx Gateway",
  "terra gateway (stanton)": "Terra Gateway",
  "green imperial housing exchange": "Grim HEX",
};

export function findLocation(locationName: string): Location | undefined {
  if (!locationName) return undefined;
  const n = normalizeLocationName(locationName);
  const alias = EXTRA_NAMES[n];
  const target = alias ? normalizeLocationName(alias) : n;
  return LOCATIONS.find((l) => normalizeLocationName(l.name) === target);
}

// System a location is in, for names the planner knows; undefined for unknown names.
export function systemOf(locationName: string): StarSystem | undefined {
  const l = findLocation(locationName);
  return l ? (l.system ?? "Stanton") : undefined;
}

export function hasExternalPort(locationName: string): boolean {
  // Multi-stop pickups are joined with " + "; flag only if every part has a cargo deck.
  const parts = locationName.split(/\s+\+\s+/).filter(Boolean);
  if (parts.length === 0) return false;
  return parts.every((p) => findLocation(p)?.externalPort ?? false);
}