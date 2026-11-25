import type { PackItem } from "./packing";
import type { Grid } from "./grids";

export type Placed = {
  item: PackItem;
  x: number;
  y: number;
  w: number;
  h: number;
};

// Place boxes so earliest delivery is closest to the door (right side).
// Simple greedy: larger boxes first, prefer right side for early deliveries.
export function packGrid(items: PackItem[], grid: Grid): Placed[] {
  const placed: Placed[] = [];
  const occupied = new Set<string>();

  const fits = (x: number, y: number, w: number, h: number) => {
    if (x + w > grid.cols || y + h > grid.rows) return false;
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        if (occupied.has(`${x + dx},${y + dy}`)) return false;
      }
    }
    return true;
  };

  const mark = (x: number, y: number, w: number, h: number) => {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        occupied.add(`${x + dx},${y + dy}`);
      }
    }
  };

  // Sort: earliest delivery first (so we place them nearer the door)
  const sorted = [...items].sort((a, b) => a.deliverOrder - b.deliverOrder);

  for (const item of sorted) {
    const size = Math.max(1, Math.min(item.containerSize || 4, 32));
    // Prefer square-ish boxes
    const w = Math.min(grid.cols, Math.ceil(Math.sqrt(size)));
    const h = Math.ceil(size / w);

    let found = false;
    // Search from right (door) to left
    for (let x = grid.cols - w; x >= 0 && !found; x--) {
      for (let y = 0; y <= grid.rows - h && !found; y++) {
        if (fits(x, y, w, h)) {
          mark(x, y, w, h);
          placed.push({ item, x, y, w, h });
          found = true;
        }
      }
    }
  }

  return placed;
}