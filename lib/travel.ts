// Approximate quantum travel times in minutes between major locations.
// Based on typical in-game distances; used for aUEC/hr estimates.

const TRAVEL: Record<string, Record<string, number>> = {
  "everus harbor": {
    "port tressler": 6,
    "seraphim": 12,
    "baijini": 10,
    "mic-l1": 8,
    "mic-l2": 9,
    "arc-l2": 14,
    "cru-l4": 11,
    "cru-l5": 10,
  },
  "port tressler": {
    "everus harbor": 6,
    "seraphim": 8,
    "baijini": 7,
    "mic-l1": 5,
    "mic-l2": 6,
    "arc-l2": 12,
    "cru-l4": 9,
    "cru-l5": 8,
  },
  "seraphim": {
    "everus harbor": 12,
    "port tressler": 8,
    "baijini": 5,
    "mic-l1": 10,
    "mic-l2": 11,
    "arc-l2": 9,
    "cru-l4": 7,
    "cru-l5": 6,
  },
  "baijini": {
    "everus harbor": 10,
    "port tressler": 7,
    "seraphim": 5,
    "mic-l1": 9,
    "mic-l2": 10,
    "arc-l2": 8,
    "cru-l4": 6,
    "cru-l5": 7,
  },
  "mic-l1": {
    "everus harbor": 8,
    "port tressler": 5,
    "seraphim": 10,
    "baijini": 9,
    "mic-l2": 4,
    "arc-l2": 11,
    "cru-l4": 8,
    "cru-l5": 7,
  },
  "mic-l2": {
    "everus harbor": 9,
    "port tressler": 6,
    "seraphim": 11,
    "baijini": 10,
    "mic-l1": 4,
    "arc-l2": 12,
    "cru-l4": 9,
    "cru-l5": 8,
  },
  "arc-l2": {
    "everus harbor": 14,
    "port tressler": 12,
    "seraphim": 9,
    "baijini": 8,
    "mic-l1": 11,
    "mic-l2": 12,
    "cru-l4": 10,
    "cru-l5": 9,
  },
};

function key(loc: string): string {
  const n = loc.toLowerCase();
  if (n.includes("everus")) return "everus harbor";
  if (n.includes("tressler")) return "port tressler";
  if (n.includes("seraphim")) return "seraphim";
  if (n.includes("baijini")) return "baijini";
  if (n.includes("mic-l1") || n.includes("shallow frontier")) return "mic-l1";
  if (n.includes("mic-l2") || n.includes("long forest")) return "mic-l2";
  if (n.includes("arc-l2") || n.includes("lively pathway")) return "arc-l2";
  if (n.includes("cru-l4") || n.includes("shallow fields")) return "cru-l4";
  if (n.includes("cru-l5") || n.includes("beautiful glen")) return "cru-l5";
  return n;
}

export function travelMinutes(from: string, to: string): number {
  if (!from || !to) return 8;
  const a = key(from);
  const b = key(to);
  if (a === b) return 0;
  return TRAVEL[a]?.[b] ?? TRAVEL[b]?.[a] ?? 8;
}