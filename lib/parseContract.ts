// Parser for Star Citizen contract screenshots (OCR text).
// Pure functions, no React or tesseract imports, so it can be tested with plain node.

export type Leg = {
  type: "pickup" | "dropoff";
  location: string;
  scu: number;
  commodity?: string;
};

// Locations that are not in lib/locations.ts but show up in contracts.
// Keys are lowercase fragments, values are the name stored in the mission.
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
  "nb int": "NB Int. Spaceport",
  spaceport: "NB Int. Spaceport",
  arccorp: "ArcCorp Mining Area 157",
  rayari: "Rayari Kaitag Research Outpost",
  kaitag: "Rayari Kaitag Research Outpost",
  kaltag: "Rayari Kaitag Research Outpost",
  hdms: "HDMS-Oparei",
  oparei: "HDMS-Oparei",
};

export function cleanOcr(text: string): string {
  return text
    .replace(/[\u2018\u2019\u02BC`]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[|©¢«»■◇◆♦<>~]/g, " ")
    .replace(/[ \t]+/g, " ");
}

// "ARC-LZ" / "MIC LS" / "arc-l2" -> "arc-l2" (OCR often swaps 5/S, 2/Z, 1/I/l).
function normalizeLCodes(lower: string): string {
  const map: Record<string, string> = { s: "5", z: "2", i: "1", l: "1", "|": "1", b: "8" };
  return lower.replace(/\b(arc|cru|hur|mic)\s*[-\u2013\u2014]?\s*l\s*([1-5szil|b])(?![a-z0-9])/g, (_m, p, d) => {
    const digit = /[1-5]/.test(d) ? d : map[d] ?? d;
    return `${p}-l${digit}`;
  });
}

// Remove left-list contract titles that leak into a window (RANK, CARGO HAUL, 56k ...).
function stripListNoise(s: string): string {
  const cut = s.search(
    /\b(?:junior|member|senior|rank|cargo haul|direct (?:medium|small|extra|large)|extra small|covalex|independent contractors|handheld)\b|\s\d{2,3}k\b/i
  );
  return (cut === -1 ? s : s.slice(0, cut)).trim();
}

export type LocationMatch = { name: string; raw: string };

function buildKeys(known: string[]): [string, string][] {
  const keys: [string, string][] = [];
  for (const [k, v] of Object.entries(LOCATION_ALIASES)) keys.push([k, v]);
  for (const n of known) {
    const lower = n.toLowerCase();
    if (lower.length >= 4) keys.push([lower, n]);
    const m = lower.match(/^([a-z]{3}-l[1-5])\s+(.+)$/);
    if (m) {
      keys.push([m[1], n]); // "arc-l2"
      if (m[2].length >= 4) keys.push([m[2], n]); // "lively pathway"
    }
  }
  return keys;
}

// Window of text right after "to" / "from": stops at the next objective keyword or sentence end,
// so wrapped/interleaved text from other columns is not swallowed.
function windowAfter(full: string, from: number, len = 80): string {
  let w = full.slice(from, from + len);
  const next = w.search(/\b(?:deliver|collect)\b/i);
  if (next !== -1) w = w.slice(0, next);
  return w;
}

export function matchLocation(windowText: string, known: string[] = []): LocationMatch {
  const cleaned = stripListNoise(windowText);
  const lower = normalizeLCodes(cleaned.toLowerCase());
  const raw = cleaned.split(/\.\s|\s+on\s+/i)[0].trim().slice(0, 40);
  let best: { idx: number; len: number; name: string } | null = null;
  for (const [key, name] of buildKeys(known)) {
    const idx = lower.indexOf(key);
    if (idx === -1) continue;
    if (!best || idx < best.idx || (idx === best.idx && key.length > best.len)) {
      best = { idx, len: key.length, name };
    }
  }
  return { name: best ? best.name : "", raw };
}

const cleanCommodity = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

function lev(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

export type Delivery = { commodity: string; location: string; scu: number; locationRaw?: string };
export type Collection = { commodity: string; location: string; scu: number; locationRaw?: string };

function finalize(
  base: { reward: number; corporation: string; lines: string[]; suggestedPickup: string | null },
  delivers: Delivery[],
  collects: Collection[],
  suggestedUsed = false
) {
  // Pair each collect with a delivery: exact commodity, then contains, then close spelling.
  const used = new Set<number>();
  const pairedCollect = new Set<number>();
  const passes: ((d: string, c: string) => boolean)[] = [
    (d, c) => d === c,
    (d, c) => d.includes(c) || c.includes(d),
    (d, c) => Math.min(d.length, c.length) >= 5 && lev(d, c) <= 2,
  ];
  for (const same of passes) {
    collects.forEach((c, ci) => {
      if (pairedCollect.has(ci)) return;
      const di = delivers.findIndex((d, i) => !used.has(i) && same(d.commodity, c.commodity));
      if (di !== -1) {
        used.add(di);
        pairedCollect.add(ci);
        c.scu = delivers[di].scu;
      }
    });
  }

  const missingPickups = delivers.filter((_, i) => !used.has(i)).map((d) => d.commodity);
  const orphanCollects = collects.filter((_, i) => !pairedCollect.has(i)).map((c) => c.commodity);
  const unknownLocations: string[] = [];
  for (const d of delivers) if (!d.location) unknownLocations.push(`deliver ${d.commodity}: "${d.locationRaw ?? ""}"`);
  for (const c of collects) if (!c.location) unknownLocations.push(`collect ${c.commodity}: "${c.locationRaw ?? ""}"`);

  const warnings: string[] = [];
  if (!delivers.length) warnings.push("no delivery objectives read");
  if (!collects.length && delivers.length) warnings.push("no pickup lines read");
  if (missingPickups.length) warnings.push(`no pickup read for: ${missingPickups.join(", ")}`);
  if (orphanCollects.length) warnings.push(`no matching delivery read for pickup: ${orphanCollects.join(", ")}`);
  if (unknownLocations.length) warnings.push(`unrecognized location: ${unknownLocations.join("; ")}`);

  const complete =
    delivers.length > 0 &&
    collects.length > 0 &&
    missingPickups.length === 0 &&
    orphanCollects.length === 0 &&
    unknownLocations.length === 0 &&
    collects.every((c) => c.scu > 0);

  const totalScu = delivers.reduce((s, d) => s + d.scu, 0);
  const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))];
  const pickup = uniq(collects.map((c) => c.location)).slice(0, 4).join(" + ");
  const dropoff = uniq(delivers.map((d) => d.location)).slice(0, 4).join(" + ");

  const legs: Leg[] = [];
  for (const c of collects) if (c.location) legs.push({ type: "pickup", location: c.location, scu: c.scu, commodity: c.commodity });
  for (const d of delivers) if (d.location) legs.push({ type: "dropoff", location: d.location, scu: d.scu, commodity: d.commodity });

  return {
    reward: base.reward,
    corporation: base.corporation,
    totalScu,
    pickup,
    dropoff,
    collects,
    delivers,
    legs,
    missingPickups,
    orphanCollects,
    unknownLocations,
    warnings,
    suggestedPickup: base.suggestedPickup,
    suggestedUsed,
    complete,
    maxContainerSize: undefined as number | undefined,
    lines: base.lines,
  };
}

export type ParsedContract = ReturnType<typeof finalize>;

export function parseContractText(rawText: string, knownLocations: string[] = []): ParsedContract {
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

  // Suggested pickup from the DETAILS prose ("A freight elevator at X has some cargo...").
  let suggestedPickup: string | null = null;
  const elev = /freight\s+elevator\s+at\s+/i.exec(full);
  if (elev) {
    const loc = matchLocation(windowAfter(full, elev.index + elev[0].length, 60), knownLocations);
    if (loc.name) suggestedPickup = loc.name;
  }

  const delivers: Delivery[] = [];
  const collects: Collection[] = [];

  // Deliver <done>/<total> SCU of <commodity> to <location>  ("0" is often read as "O")
  const deliverRe = /deliver\s+[0-9OoIl]+\s*\/\s*(\d+)\s*SCU\s+of\s+([a-z][a-z' ]{1,40}?)\s+to\s+/gi;
  let m: RegExpExecArray | null;
  while ((m = deliverRe.exec(full)) !== null) {
    const scu = parseInt(m[1], 10);
    const commodity = cleanCommodity(m[2]);
    const loc = matchLocation(windowAfter(full, m.index + m[0].length), knownLocations);
    if (commodity && scu > 0) delivers.push({ commodity, location: loc.name, scu, locationRaw: loc.raw });
  }

  // Collect <commodity> from|at <location>
  const collectRe = /collect\s+([a-z][a-z' ]{1,40}?)\s+(?:from|at)\s+/gi;
  while ((m = collectRe.exec(full)) !== null) {
    const commodity = cleanCommodity(m[1]);
    const loc = matchLocation(windowAfter(full, m.index + m[0].length), knownLocations);
    if (commodity) collects.push({ commodity, location: loc.name, scu: 0, locationRaw: loc.raw });
  }

  return finalize({ reward, corporation, lines: text.split(/\n+/), suggestedPickup }, delivers, collects);
}

// When the small "Collect ..." lines could not be read but the DETAILS text names the pickup,
// let the user accept that location for every delivery that has no pickup. Never automatic.
export function applySuggestedPickups(r: ParsedContract): ParsedContract {
  if (!r.suggestedPickup || r.missingPickups.length === 0) return r;
  const collects = r.collects.map((c) => ({ ...c }));
  for (const commodity of r.missingPickups) {
    const d = r.delivers.find((x) => x.commodity === commodity);
    collects.push({ commodity, location: r.suggestedPickup, scu: d ? d.scu : 0 });
  }
  const delivers = r.delivers.map((d) => ({ ...d }));
  return finalize(
    { reward: r.reward, corporation: r.corporation, lines: r.lines, suggestedPickup: r.suggestedPickup },
    delivers,
    collects,
    true
  );
}

// Higher is better; used to choose between OCR passes.
export function scoreParse(r: ParsedContract): number {
  return (
    (r.complete ? 1000 : 0) +
    r.delivers.length * 3 +
    r.collects.length * 3 -
    r.warnings.length * 2 +
    (r.reward ? 1 : 0)
  );
}

// Two OCR reads of the same screenshot can both look complete and still disagree on a digit
// (e.g. "0/4 SCU" read as "0/74"). Compare reads by quantities and locations, not spelling.
export function signature(r: ParsedContract): string {
  const d = r.delivers.map((x) => `${x.scu}@${x.location}`).sort();
  const c = r.collects.map((x) => `${x.scu}@${x.location}`).sort();
  return `D:${d.join(",")}|C:${c.join(",")}`;
}

export type Consensus = {
  chosen: ParsedContract | null;
  // "agreed": two or more complete reads match. "single": only one complete read, unverified.
  // "conflict": complete reads disagree. "none": no complete read.
  state: "agreed" | "single" | "conflict" | "none";
  detail: string;
};

export function pickConsensus(reads: ParsedContract[]): Consensus {
  const complete = reads.filter((r) => r.complete);
  if (complete.length === 0) return { chosen: null, state: "none", detail: "" };
  const groups = new Map<string, ParsedContract[]>();
  for (const r of complete) {
    const k = signature(r);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const best = [...groups.values()].sort((a, b) => b.length - a.length)[0];
  if (best.length >= 2) return { chosen: best[0], state: "agreed", detail: "" };
  if (groups.size === 1) return { chosen: best[0], state: "single", detail: "" };
  const parts = [...groups.values()].map((g) => g[0].delivers.map((d) => `${d.commodity} ${d.scu}`).join(", "));
  return { chosen: null, state: "conflict", detail: parts.join(" vs ") };
}
