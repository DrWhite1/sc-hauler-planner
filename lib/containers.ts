// Star Citizen standard cargo containers (SCU).
// 1 SCU = 1.25 x 1.25 x 1.25 m external.
// Containers snap to the cargo grid in these sizes only.

export const STANDARD_CONTAINERS = [1, 2, 4, 8, 16, 32] as const;
export type ContainerSize = (typeof STANDARD_CONTAINERS)[number];

// Used when neither the mission nor the ship tells us the largest box.
export const DEFAULT_MAX_CONTAINER: ContainerSize = 32;

export type BoxCount = { size: ContainerSize; count: number };

export function nearestContainer(scu: number): ContainerSize {
  const sizes = STANDARD_CONTAINERS;
  for (const s of sizes) {
    if (scu <= s) return s;
  }
  return 32;
}

// Largest standard container that is <= maxSize (e.g. 24 -> 16). Anything below 1 -> 1.
export function largestAllowedContainer(maxSize: number | undefined | null): ContainerSize {
  const max = Number(maxSize);
  if (!Number.isFinite(max) || max <= 0) return DEFAULT_MAX_CONTAINER;
  let best: ContainerSize = 1;
  for (const s of STANDARD_CONTAINERS) {
    if (s <= max) best = s;
  }
  return best;
}

// Which max container size applies to a mission: the mission's own value, otherwise the
// ship's max container, otherwise 32. `assumed` is true when the mission did not say.
export function resolveMaxContainer(
  missionMax: number | undefined | null,
  shipMax?: number | undefined | null
): { size: ContainerSize; assumed: boolean } {
  if (missionMax && missionMax > 0) return { size: largestAllowedContainer(missionMax), assumed: false };
  if (shipMax && shipMax > 0) return { size: largestAllowedContainer(shipMax), assumed: true };
  return { size: DEFAULT_MAX_CONTAINER, assumed: true };
}

// Greedy split from the largest allowed box down. The total always adds up exactly,
// e.g. 76 SCU at max 8 -> 9 x 8 + 1 x 4. Returns only sizes with a count > 0, largest first.
export function boxBreakdown(totalScu: number, maxSize: number | undefined | null): BoxCount[] {
  let remaining = Math.max(0, Math.floor(Number(totalScu) || 0));
  const largest = largestAllowedContainer(maxSize);
  const result: BoxCount[] = [];
  for (let i = STANDARD_CONTAINERS.length - 1; i >= 0; i--) {
    const size = STANDARD_CONTAINERS[i];
    if (size > largest) continue;
    const count = Math.floor(remaining / size);
    if (count > 0) {
      result.push({ size, count });
      remaining -= count * size;
    }
  }
  return result;
}

// Add several breakdowns together (e.g. several missions at one stop).
export function mergeBreakdowns(...lists: BoxCount[][]): BoxCount[] {
  const counts = new Map<ContainerSize, number>();
  for (const list of lists) {
    for (const b of list) counts.set(b.size, (counts.get(b.size) || 0) + b.count);
  }
  return [...counts.entries()]
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[0] - a[0])
    .map(([size, count]) => ({ size, count }));
}

export function breakdownTotal(list: BoxCount[]): number {
  return list.reduce((sum, b) => sum + b.size * b.count, 0);
}

export function breakdownBoxes(list: BoxCount[]): number {
  return list.reduce((sum, b) => sum + b.count, 0);
}

// "9×8 + 1×4" (counts × SCU). Empty breakdown -> "—".
export function formatBreakdown(list: BoxCount[]): string {
  if (list.length === 0) return "—";
  return list.map((b) => `${b.count}×${b.size}`).join(" + ");
}

// Flat list of box sizes, largest first: 76 @ 8 -> [8,8,8,8,8,8,8,8,8,4].
export function splitIntoContainers(totalScu: number, maxSize: number): number[] {
  const out: number[] = [];
  for (const b of boxBreakdown(totalScu, maxSize)) {
    for (let i = 0; i < b.count; i++) out.push(b.size);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Per-stop box breakdown for the optimized route.
// Kept in this file (types only, no runtime imports) so it can be unit tested with plain node.

export type StopLike = {
  type: "pickup" | "dropoff";
  location: string;
  scu: number;
  missionId: string;
  commodity?: string;
  cargoAfter?: number;
};

export type MissionLike = { id: string; maxContainerSize?: number };

export type MissionBoxes = {
  missionId: string;
  scu: number;
  maxSize: ContainerSize;
  assumed: boolean;
  boxes: BoxCount[];
  commodities: string[];
};

export type StopGroup<S extends StopLike = StopLike> = {
  type: "pickup" | "dropoff";
  location: string;
  stops: S[];
  indices: number[]; // positions in the original stop list
  scu: number;
  boxes: BoxCount[]; // combined over all missions at this stop
  perMission: MissionBoxes[];
  assumed: boolean; // true if any mission's max container size was assumed
  cargoAfter?: number;
};

function groupKey(loc: string): string {
  return loc.toLowerCase().replace(/\s+above\s.*$/, "").replace(/\s+station$/, "").replace(/\s+/g, " ").trim();
}

// Box breakdown for one stop (one mission leg). Each leg is one commodity and boxes never
// mix commodities, so the split is done per leg and then added up.
export function stopBoxes(
  stop: StopLike,
  mission: MissionLike | undefined,
  shipMax?: number
): { maxSize: ContainerSize; assumed: boolean; boxes: BoxCount[] } {
  const { size, assumed } = resolveMaxContainer(mission?.maxContainerSize, shipMax);
  return { maxSize: size, assumed, boxes: boxBreakdown(stop.scu, size) };
}

// Merge consecutive stops of the same type at the same location into one visit and work out
// how many boxes of each size change hands there, per mission and combined.
export function groupStopsWithBoxes<S extends StopLike>(
  stops: S[],
  missions: MissionLike[],
  shipMax?: number
): StopGroup<S>[] {
  const byId = new Map(missions.map((m) => [m.id, m]));
  const groups: StopGroup<S>[] = [];

  stops.forEach((stop, index) => {
    const last = groups[groups.length - 1];
    let group: StopGroup<S>;
    if (last && last.type === stop.type && groupKey(last.location) === groupKey(stop.location)) {
      group = last;
    } else {
      group = {
        type: stop.type,
        location: stop.location,
        stops: [],
        indices: [],
        scu: 0,
        boxes: [],
        perMission: [],
        assumed: false,
      };
      groups.push(group);
    }

    const sb = stopBoxes(stop, byId.get(stop.missionId), shipMax);
    group.stops.push(stop);
    group.indices.push(index);
    group.scu += stop.scu;
    group.cargoAfter = stop.cargoAfter;
    group.assumed = group.assumed || sb.assumed;
    group.boxes = mergeBreakdowns(group.boxes, sb.boxes);

    let pm = group.perMission.find((p) => p.missionId === stop.missionId);
    if (!pm) {
      pm = { missionId: stop.missionId, scu: 0, maxSize: sb.maxSize, assumed: sb.assumed, boxes: [], commodities: [] };
      group.perMission.push(pm);
    }
    pm.scu += stop.scu;
    pm.boxes = mergeBreakdowns(pm.boxes, sb.boxes);
    if (stop.commodity && !pm.commodities.includes(stop.commodity)) pm.commodities.push(stop.commodity);
  });

  return groups;
}
