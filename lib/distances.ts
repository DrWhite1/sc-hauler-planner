// Distances in Gm (million km) between the places the planner knows, per star system.
// Source: UEX Corp API /2.0/orbits_distances (community-measured, game versions 4.0-4.10,
// fetched 2026-11-26). Stations sit at their orbit's entry: Everus Harbor/Lorville = Hurston,
// Port Tressler/New Babbage = microTech, Seraphim/Orison/Grim HEX/Kareah = Crusader,
// Baijini/Area18 = ArcCorp, Levski = Delamar. A pair UEX has no figure for is filled with the
// shortest path through another known place. Regenerate: python3 scripts/gen-distances.py

export type DistanceTable = { names: string[]; gm: number[] }; // gm: upper triangle, row by row

export const DISTANCES_GM: Record<string, DistanceTable> = {
  Stanton: {
    names: ["Everus Harbor", "Port Tressler", "Seraphim Station", "Baijini Point", "Port Olisar", "Grim HEX", "Lorville", "Area18", "New Babbage", "Orison", "ARC-L1 Wide Forest", "ARC-L2 Lively Pathway", "ARC-L3 Modern Express", "ARC-L4 Faint Glen", "ARC-L5 Yellow Core", "CRU-L1 Ambitious Dream", "CRU-L4 Shallow Fields", "CRU-L5 Beautiful Glen", "HUR-L1 Green Glade", "HUR-L2 Faithful Dream", "HUR-L3 Thundering Express", "HUR-L4 Melodic Fields", "HUR-L5 High Course", "MIC-L1 Shallow Frontier", "MIC-L2 Long Forest", "MIC-L3 Endless Odyssey", "MIC-L4 Red Crossroads", "MIC-L5 Modern Icarus", "Pyro Gateway", "Nyx Gateway", "Terra Gateway", "Magnus Gateway", "Security Post Kareah"],
    gm: [
      38, 32, 23, 32, 32, 0, 23, 38, 32, 20, 26, 41, 16, 35, 30, 27, 29, 1, 1, 26, 13, 13, 34, 43,
      51, 51, 31, 30, 81, 39, 81, 32, 57, 59, 57, 57, 38, 59, 0, 57, 57, 62, 53, 33, 72, 56, 62, 41,
      39, 38, 51, 31, 51, 4, 4, 87, 43, 43, 68, 88, 51, 88, 57, 42, 0, 0, 32, 42, 57, 0, 40, 45,
      18, 48, 26, 2, 19, 19, 31, 33, 7, 29, 27, 53, 62, 35, 41, 62, 34, 54, 70, 54, 0, 42, 42, 23,
      0, 59, 42, 3, 3, 57, 29, 29, 41, 26, 48, 23, 23, 38, 35, 16, 56, 63, 44, 72, 33, 17, 95, 37,
      95, 42, 0, 32, 42, 57, 0, 40, 45, 18, 48, 26, 2, 19, 19, 31, 33, 7, 29, 27, 53, 62, 35, 41,
      62, 34, 54, 70, 54, 0, 32, 42, 57, 0, 40, 45, 18, 48, 26, 2, 19, 19, 31, 33, 7, 29, 27, 53,
      62, 35, 41, 62, 34, 54, 70, 54, 0, 23, 38, 32, 20, 26, 41, 16, 35, 30, 27, 29, 1, 1, 26, 13,
      13, 34, 43, 51, 51, 31, 30, 81, 39, 81, 32, 59, 42, 3, 3, 57, 29, 29, 41, 26, 48, 23, 23, 38,
      35, 16, 56, 63, 44, 72, 33, 17, 95, 37, 95, 42, 57, 57, 62, 53, 33, 72, 56, 62, 41, 39, 38, 51,
      31, 51, 4, 4, 87, 43, 43, 68, 88, 51, 88, 57, 40, 45, 18, 48, 26, 2, 19, 19, 31, 33, 7, 29,
      27, 53, 62, 35, 41, 62, 34, 54, 70, 54, 0, 6, 54, 28, 28, 38, 24, 45, 21, 20, 36, 33, 14, 54,
      61, 43, 69, 33, 16, 92, 38, 92, 40, 60, 30, 30, 43, 28, 51, 26, 25, 41, 38, 19, 58, 65, 45, 75,
      33, 18, 98, 36, 98, 45, 54, 44, 19, 37, 13, 39, 42, 19, 32, 41, 49, 56, 52, 24, 70, 51, 43, 79,
      43, 18, 50, 46, 42, 42, 18, 15, 42, 23, 27, 30, 36, 66, 59, 16, 42, 95, 25, 95, 48, 26, 10, 42,
      35, 36, 27, 42, 23, 68, 76, 16, 66, 59, 13, 76, 65, 76, 26, 18, 18, 29, 31, 5, 27, 25, 52, 60,
      35, 41, 61, 33, 56, 68, 56, 2, 33, 26, 28, 19, 32, 15, 58, 67, 25, 57, 53, 15, 72, 60, 72, 19,
      28, 30, 15, 19, 32, 37, 45, 53, 25, 57, 46, 55, 66, 55, 19, 3, 24, 12, 12, 35, 43, 50, 50, 32,
      29, 80, 40, 80, 31, 27, 14, 14, 34, 42, 52, 52, 29, 30, 82, 38, 82, 33, 22, 22, 47, 56, 38, 39,
      56, 32, 58, 64, 48, 7, 22, 26, 35, 56, 38, 39, 39, 73, 48, 64, 29, 47, 55, 39, 56, 38, 17, 80,
      45, 60, 27, 9, 83, 41, 41, 64, 86, 50, 86, 53, 91, 46, 46, 72, 91, 53, 91, 62, 75, 75, 27, 75,
      80, 75, 35, 75, 70, 48, 84, 48, 41, 49, 110, 10, 110, 62, 86, 53, 86, 34, 119, 86, 54, 120, 70, 54,
    ],
  },
  Pyro: {
    names: ["Stanton Gateway (Pyro)", "Nyx Gateway (Pyro)", "Ruin Station", "Checkmate", "Orbituary", "Gaslight", "Starlight Service Station", "Dudley & Daughters", "Patch City", "Megumi Refueling", "Endgame", "Rod's Fuel 'N Supplies", "Rat's Nest"],
    gm: [
      103, 83, 48, 60, 96, 59, 119, 55, 22, 87, 52, 90, 86, 58, 48, 33, 47, 28, 56, 117, 88, 81, 30, 77,
      52, 80, 54, 78, 86, 78, 136, 108, 56, 28, 48, 26, 78, 10, 65, 60, 33, 53, 56, 2, 58, 35, 71, 86,
      61, 30, 55, 61, 41, 114, 57, 58, 55, 59, 34, 70, 84, 59, 31, 79, 128, 115, 105, 29, 74, 51, 27, 57,
      108, 74, 99, 35, 101, 84,
    ],
  },
  Nyx: {
    names: ["Levski", "Stanton Gateway (Nyx)", "Pyro Gateway (Nyx)"],
    gm: [
      13, 32, 44,
    ],
  },
};
