export type RouteStop = {
  type: "pickup" | "dropoff";
  scu: number;
  missionId: string;
  commodity?: string;
};

// A route is valid only if every dropoff is covered by cargo already picked up for the same
// mission, so cargo is never delivered before it is loaded. Cargo is tracked per commodity when
// every pickup and dropoff of a mission names the same commodities, otherwise per mission total
// (an OCR slip in a commodity name must not make every route look impossible).
export function isValidOrder(stops: RouteStop[]): boolean {
  const perCommodity = new Map<string, boolean>();
  const pick = new Map<string, Set<string>>();
  const drop = new Map<string, Set<string>>();
  for (const s of stops) {
    const target = s.type === "pickup" ? pick : drop;
    const set = target.get(s.missionId) ?? new Set<string>();
    set.add(s.commodity ?? "");
    target.set(s.missionId, set);
  }
  for (const [id, p] of pick) {
    const d = drop.get(id) ?? new Set<string>();
    const same = p.size === d.size && [...p].every((c) => c !== "" && d.has(c));
    perCommodity.set(id, same);
  }

  const onboard = new Map<string, number>();
  for (const s of stops) {
    const key = perCommodity.get(s.missionId) ? `${s.missionId}|${s.commodity}` : s.missionId;
    const have = onboard.get(key) ?? 0;
    if (s.type === "pickup") onboard.set(key, have + s.scu);
    else {
      if (have < s.scu) return false;
      onboard.set(key, have - s.scu);
    }
  }
  return true;
}
