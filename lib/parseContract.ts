// Parser for Star Citizen contract screenshots (OCR text).
// Pure functions, no React or tesseract imports, so it can be tested with plain node.

export type Leg = {
  type: "pickup" | "dropoff";
  location: string;
  scu: number;
  commodity?: string;
};

export const LOCATION_ALIASES: Record<string, string> = {
  tressler: "Port Tressler",
  ressler: "Port Tressler",
  goldenrod: "Sakura Sun Goldenrod Workcenter",
  "sakura sun": "Sakura Sun Goldenrod Workcenter",
  everus: "Everus Harbor",
  seraphim: "Seraphim Station",
  baijini: "Baijini Point",
  brio: "Brio's Breaker Yard",
  sacren: "Sacren's Plot",
  "modern icarus": "MIC-L5 Modern Icarus",
  "modern ic": "MIC-L5 Modern Icarus",
  "mic-l": "MIC-L5 Modern Icarus",
  "nb int": "NB Int. Spaceport",
  spaceport: "NB Int. Spaceport",
  arccorp: "ArcCorp Mining Area 157",
  rayari: "Rayari Kaitag Research Outpost",
  kaitag: "Rayari Kaitag Research Outpost",
  kaltag: "Rayari Kaitag Research Outpost",
  hdms: "HDMS-Oparei",
  oparei: "HDMS-Oparei",
};

// Look at the text right after "to" / "from". The OCR may have interleaved other
// columns into the sentence, so we do not trust where the sentence ends. We take a
// short window, cut it at the first sentence end and pick the alias that appears
// EARLIEST in that window.
export function normalizeLocation(rawWindow: string): string {
  const lower = rawWindow.toLowerCase();
  let best: { idx: number; val: string } | null = null;
  for (const [key, val] of Object.entries(LOCATION_ALIASES)) {
    const idx = lower.indexOf(key);
    if (idx !== -1 && (!best || idx < best.idx)) best = { idx, val };
  }
  if (best) return best.val;
  return rawWindow.split(/\.\s|\s+on\s+/i)[0].trim();
}

export function cleanOcr(text: string): string {
  return text
    .replace(/[\u2018\u2019\u02BC`]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[|©¢«»■◇◆♦<>~]/g, " ")
    .replace(/[ \t]+/g, " ");
}

function windowAfter(full: string, from: number, len = 70): string {
  return full.slice(from, from + len);
}

const cleanCommodity = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

export type Delivery = { commodity: string; location: string; scu: number };
export type Collection = { commodity: string; location: string; scu: number };

export function parseContractText(rawText: string) {
  const text = cleanOcr(rawText);
  const full = text.replace(/\s+/g, " ");

  // Reward
  let reward = 0;
  const rewardMatch = full.match(/reward[^\d]*([\d,.]{4,})/i);
  if (rewardMatch) {
    const v = parseInt(rewardMatch[1].replace(/[,.]/g, ""), 10);
    if (v >= 10000) reward = v;
  }
  if (!reward) {
    const nums = full.match(/\d[\d,]{4,}/g) || [];
    for (const n of nums) {
      const v = parseInt(n.replace(/,/g, ""), 10);
      if (v >= 20000 && v < 5000000) reward = Math.max(reward, v);
    }
  }

  // Corporation: "Contracted By <name>" on one line
  let corporation = "";
  for (const line of text.split(/\n/)) {
    const m = line.match(/contracted\s+by\s+(.+)$/i);
    if (m) {
      corporation = m[1].trim();
      break;
    }
  }

  const delivers: Delivery[] = [];
  const collects: Collection[] = [];

  // Deliver <done>/<total> SCU of <commodity> to <location>
  // "0" is often read as "O"; commodity runs up to " to " (max 4 words).
  const deliverRe = /deliver\s+[0-9OoIl]+\s*\/\s*(\d+)\s*SCU\s+of\s+([a-z][a-z' ]{1,40}?)\s+to\s+/gi;
  let m: RegExpExecArray | null;
  while ((m = deliverRe.exec(full)) !== null) {
    const scu = parseInt(m[1], 10);
    const commodity = cleanCommodity(m[2]);
    const location = normalizeLocation(windowAfter(full, m.index + m[0].length));
    if (commodity && location && scu > 0) delivers.push({ commodity, location, scu });
  }

  // Collect <commodity> from|at <location>
  const collectRe = /collect\s+([a-z][a-z' ]{1,40}?)\s+(?:from|at)\s+/gi;
  while ((m = collectRe.exec(full)) !== null) {
    const commodity = cleanCommodity(m[1]);
    const location = normalizeLocation(windowAfter(full, m.index + m[0].length));
    if (commodity && location) collects.push({ commodity, location, scu: 0 });
  }

  // Pair collects with deliveries by commodity so each pickup gets its real SCU.
  const used = new Set<number>();
  for (const c of collects) {
    let idx = delivers.findIndex((d, i) => !used.has(i) && d.commodity === c.commodity);
    if (idx === -1) {
      idx = delivers.findIndex(
        (d, i) => !used.has(i) && (d.commodity.includes(c.commodity) || c.commodity.includes(d.commodity))
      );
    }
    if (idx !== -1) {
      used.add(idx);
      c.scu = delivers[idx].scu;
    }
  }
  // Unpaired collects: only guess when there is exactly one delivery left over
  const leftover = delivers.filter((_, i) => !used.has(i));
  for (const c of collects) {
    if (c.scu === 0 && leftover.length === 1 && collects.filter((x) => x.scu === 0).length === 1) {
      c.scu = leftover[0].scu;
    }
  }

  const totalScu = delivers.reduce((s, d) => s + d.scu, 0) || collects.reduce((s, c) => s + c.scu, 0);

  const pickupLocs = [...new Set(collects.map((c) => c.location).filter(Boolean))];
  const dropoffLocs = [...new Set(delivers.map((d) => d.location).filter(Boolean))];
  const pickup = pickupLocs.slice(0, 4).join(" + ");
  const dropoff = dropoffLocs.slice(0, 4).join(" + ");

  const legs: Leg[] = [];
  for (const c of collects) legs.push({ type: "pickup", location: c.location, scu: c.scu, commodity: c.commodity });
  for (const d of delivers) legs.push({ type: "dropoff", location: d.location, scu: d.scu, commodity: d.commodity });

  // Objectives we could not read: a delivery whose commodity has no matching collect, and vice versa.
  const missingPickups = delivers.filter((d, i) => !used.has(i)).map((d) => d.commodity);
  const complete = delivers.length > 0 && collects.length > 0 && missingPickups.length === 0;

  return {
    reward,
    corporation,
    totalScu,
    pickup,
    dropoff,
    collects,
    delivers,
    legs,
    missingPickups,
    complete,
    maxContainerSize: undefined as number | undefined,
    lines: text.split(/\n+/),
  };
}
