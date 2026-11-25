// Cargo hold model for the cargo grid: one cell per SCU of ship capacity.
// Types-only imports so this can be unit tested with plain node.
import type { BoxCount } from "./containers";

export type HoldItem = {
  missionId: string;
  boxes: BoxCount[]; // what is on board for this mission, largest boxes first
  deliverOrder: number; // 1 = delivered first
  label?: string;
};

export type HoldCell = {
  missionId: string;
  boxSize: number;
  boxIndex: number; // running box number in the hold (0-based), to tell neighbours apart
  label?: string;
};

export type Hold = {
  cells: (HoldCell | null)[]; // length = capacity
  used: number; // SCU placed
  overflow: number; // SCU that did not fit
};

// Fill the hold from the back (cell 0) towards the door (last cell). Cargo that is delivered
// last goes in first, so the first delivery ends up nearest the door. Each box takes as many
// consecutive cells as its size in SCU.
export function fillHold(items: HoldItem[], capacity: number): Hold {
  const cap = Math.max(0, Math.floor(capacity));
  const cells: (HoldCell | null)[] = new Array(cap).fill(null);
  const order = [...items].sort((a, b) => b.deliverOrder - a.deliverOrder);
  let pos = 0;
  let overflow = 0;
  let boxIndex = 0;
  for (const item of order) {
    for (const b of item.boxes) {
      for (let n = 0; n < b.count; n++) {
        if (pos + b.size > cap) {
          overflow += b.size;
          continue;
        }
        for (let k = 0; k < b.size; k++) {
          cells[pos + k] = { missionId: item.missionId, boxSize: b.size, boxIndex, label: item.label };
        }
        pos += b.size;
        boxIndex++;
      }
    }
  }
  return { cells, used: pos, overflow };
}

export type GridLayout = { cell: number; rows: number; cols: number; width: number; height: number };

// Cells are laid out column by column (top to bottom, then the next column to the right),
// so the hold fills from the back wall (left) towards the door (right).
export function cellPosition(index: number, layout: GridLayout): { x: number; y: number } {
  const col = Math.floor(index / layout.rows);
  const row = index % layout.rows;
  return { x: col * layout.cell, y: row * layout.cell };
}

export function cellAt(x: number, y: number, layout: GridLayout, count: number): number | null {
  if (x < 0 || y < 0) return null;
  const col = Math.floor(x / layout.cell);
  const row = Math.floor(y / layout.cell);
  if (row >= layout.rows || col >= layout.cols) return null;
  const idx = col * layout.rows + row;
  return idx < count ? idx : null;
}

function shape(count: number, cell: number, rows: number): GridLayout {
  const r = Math.max(1, rows);
  const cols = Math.max(1, Math.ceil(count / r));
  return { cell, rows: r, cols, width: cols * cell, height: r * cell };
}

// "Fit to window": the biggest square size (up to maxCell) that shows every cell inside
// width x height without scrolling.
export function fitLayout(count: number, width: number, height: number, maxCell = 24, minCell = 0.5): GridLayout {
  const n = Math.max(1, Math.floor(count));
  const W = Math.max(1, width);
  const H = Math.max(1, height);
  const fits = (c: number) => Math.floor(W / c) * Math.floor(H / c) >= n;
  let cell: number;
  if (fits(maxCell)) {
    cell = maxCell;
  } else {
    let lo = minCell;
    let hi = maxCell;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) lo = mid;
      else hi = mid;
    }
    cell = Math.max(minCell, Math.floor(lo * 4) / 4); // quarter-pixel steps
    while (cell > minCell && !fits(cell)) cell -= 0.25;
  }
  const rowsMax = Math.max(1, Math.floor(H / cell));
  const colsMax = Math.max(1, Math.floor(W / cell));
  // Squarish for small holds, as tall as the panel allows for big ones.
  const rows = Math.min(rowsMax, Math.max(Math.ceil(n / colsMax), Math.ceil(Math.sqrt(n))));
  return shape(n, cell, rows);
}

// "Actual size": fixed, readable squares. As wide as the panel allows; scrolls vertically.
export function actualLayout(count: number, width: number, cell = 14): GridLayout {
  const n = Math.max(1, Math.floor(count));
  const colsMax = Math.max(1, Math.floor(Math.max(1, width) / cell));
  const cols = Math.min(colsMax, Math.max(1, Math.ceil(Math.sqrt(n))));
  const rows = Math.ceil(n / cols);
  return shape(n, cell, rows);
}
