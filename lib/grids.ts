export type Grid = { cols: number; rows: number };

// Approximate floor grids (1 cell = 1 SCU). Door is on the right (last column).
export const SHIP_GRIDS: Record<string, Grid> = {
  "avenger-titan": { cols: 4, rows: 2 },
  "nomad": { cols: 6, rows: 4 },
  "cutlass-black": { cols: 8, rows: 6 },
  "c1-spirit": { cols: 8, rows: 8 },
  "zeus-cl": { cols: 16, rows: 8 },
  "freelancer": { cols: 11, rows: 6 },
  "freelancer-max": { cols: 12, rows: 10 },
  "constellation-taurus": { cols: 14, rows: 12 },
  "raft": { cols: 16, rows: 12 },
  "corsair": { cols: 9, rows: 8 },
  "caterpillar": { cols: 24, rows: 24 },
  "starlancer-max": { cols: 16, rows: 14 },
  "c2-hercules": { cols: 29, rows: 24 },
  "m2-hercules": { cols: 26, rows: 18 },
  "hull-a": { cols: 8, rows: 8 },
  "hull-c": { cols: 48, rows: 48 },
  "carrack": { cols: 19, rows: 24 },
  "ironclad": { cols: 40, rows: 55 },
};

export function getGrid(shipId: string): Grid {
  return SHIP_GRIDS[shipId] || { cols: 10, rows: 10 };
}