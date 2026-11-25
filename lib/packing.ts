import type { Stop } from "./optimizer";
import type { Mission } from "./store";
import { boxBreakdown, resolveMaxContainer, type BoxCount } from "./containers";

export type PackItem = {
  missionId: string;
  location: string;
  scu: number;
  commodity?: string;
  containerSize: number; // largest box used for this cargo
  containerAssumed: boolean; // true if the mission did not state a max container size
  boxes: BoxCount[]; // e.g. 76 SCU at max 8 -> 9 x 8 + 1 x 4
  loadOrder: number; // 1 = load first (deepest in hold)
  deliverOrder: number; // 1 = deliver first
};

export function buildPackingOrder(
  stops: Stop[],
  missions: Mission[],
  maxContainer: number
): PackItem[] {
  // Collect all pickup stops in reverse route order so first delivery is loaded last
  const pickups = stops.filter((s) => s.type === "pickup");
  const dropoffs = stops.filter((s) => s.type === "dropoff");

  // Map mission to its first dropoff index (deliver order)
  const deliverIndex = new Map<string, number>();
  dropoffs.forEach((d, i) => {
    if (!deliverIndex.has(d.missionId)) deliverIndex.set(d.missionId, i);
  });

  const items: PackItem[] = [];
  for (const p of pickups) {
    const mission = missions.find((m) => m.id === p.missionId);
    const { size: containerSize, assumed } = resolveMaxContainer(mission?.maxContainerSize, maxContainer);
    const deliverOrder = (deliverIndex.get(p.missionId) ?? 999) + 1;
    items.push({
      missionId: p.missionId,
      location: p.location,
      scu: p.scu,
      commodity: p.commodity,
      containerSize,
      containerAssumed: assumed,
      boxes: boxBreakdown(p.scu, containerSize),
      loadOrder: 0,
      deliverOrder,
    });
  }

  // Sort so earliest delivery is loaded last (nearest the door)
  items.sort((a, b) => b.deliverOrder - a.deliverOrder);
  items.forEach((item, i) => {
    item.loadOrder = i + 1;
  });

  return items;
}