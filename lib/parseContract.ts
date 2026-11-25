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
  rayari: "Rayari Kaitag Research Outpost",
  kaitag: "Rayari Kaitag Research Outpost",
  kaltag: "Rayari Kaitag Research Outpost",
  "hdms-ryder": "HDMS-Ryder",
  ryder: "HDMS-Ryder",
  arccorp: "ArcCorp Mining Area",
  "sunset mesa": "Sunset Mesa",
  "greycat stanton iv": "Greycat Stanton IV Production Complex-A",
  "production complex-a": "Greycat Stanton IV Production Complex-A",
  hdms: "HDMS-Oparei",
  oparei: "HDMS-Oparei",
};

export function cleanOcr(text: string): string {
  return text
    .replace(/[\u2018\u2019\u02BC`]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\bd[eo][l1I]{1,2}[iIl1]ver/gi, "Deliver")
    .replace(/\bco[l1I]{2}[eo]ct/gi, "Collect")
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

export type LocationMatch = { name: string; raw: string; listed?: boolean };

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
  const raw = cleaned.replace(/-\s+(?=[0-9A-Za-z])/g, "-").split(/\.(?:\s|$)|\s+on\s+/i)[0].trim().replace(/\.$/, "").slice(0, 50);
  // "ArcCorp Mining Area 141": the number is part of the name.
  const arc = /arc\s*corp\s+mining\s+are[a-z]\s+([0-9OoIl]{2,3})/i.exec(cleaned);
  if (arc) {
    const digits = arc[1].replace(/[Oo]/g, "0").replace(/[Il]/g, "1");
    return { name: `ArcCorp Mining Area ${digits}`, raw };
  }
  let best: { idx: number; len: number; name: string } | null = null;
  for (const [key, name] of buildKeys(known)) {
    const idx = lower.indexOf(key);
    if (idx === -1) continue;
    if (!best || idx < best.idx || (idx === best.idx && key.length > best.len)) {
      best = { idx, len: key.length, name };
    }
  }
  if (!best) {
    // One or two wrong letters in an alias ("Sunaet Mesa"): match the closest alias.
    for (const [key, name] of Object.entries(LOCATION_ALIASES)) {
      if (key.length < 8) continue;
      const cand = lower.slice(0, key.length + 1);
      for (let w = key.length - 1; w <= key.length + 1; w++) {
        if (w > 0 && lev(cand.slice(0, w), key) <= 1) best = { idx: 0, len: key.length, name };
      }
    }
  }
  if (best) return { name: best.name, raw };
  // Not in the location list: accept a well-formed name ("Sunset Mesa") so new places work.
  // Garbled reads differ between OCR passes, so the consensus check rejects them.
  return { name: looksLikeLocation(raw) ? raw : "", raw, listed: false };
}

function looksLikeLocation(raw: string): boolean {
  if (raw.endsWith("-")) return false; // wrapped name whose last part was not read
  if (!/^[A-Z][A-Za-z0-9'\-]+( [A-Za-z0-9'\-]+){0,5}$/.test(raw)) return false;
  return raw.split(" ").every((t) => t.length >= 2 || /^[AIVX]$/.test(t));
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

const BOX_SIZES = [1, 2, 4, 8, 16, 24, 32];

// Largest container the contract allows. Contract briefings phrase it as e.g.
// "a ship that can handle 4 SCU cargo containers", "can hold 2 SCU cargo containers",
// or "Max container size: 16 SCU". Returns undefined when the text does not say.
export function parseMaxContainerSize(full: string): number | undefined {
  const patterns = [
    /(?:handle|hold|carry|fit|take|accept|accommodate|support)s?\s+(?:up\s+to\s+)?(\d{1,2})\s*SCU\s+(?:cargo\s+)?(?:containers?|boxes|crates)/i,
    /(?:max(?:imum)?|largest)\.?\s+(?:cargo\s+)?(?:container|box|crate)(?:\s+size)?\s*(?:of|is|:)?\s*(\d{1,2})\s*SCU/i,
    /(\d{1,2})\s*SCU\s+(?:cargo\s+)?(?:containers?|boxes|crates)\s+(?:max(?:imum)?|or\s+smaller|or\s+less)/i,
  ];
  for (const re of patterns) {
    const m = full.match(re);
    if (m) {
      const v = parseInt(m[1], 10);
      if (BOX_SIZES.includes(v)) return v;
    }
  }
  return undefined;
}

// Max container size across several OCR reads of one screenshot: the value most reads agree on.
// A tie between different values is an unreliable read, so it stays unknown (the planner then
// falls back to the ship's max container size and marks it as assumed).
export function voteMaxContainerSize(reads: { maxContainerSize?: number }[]): number | undefined {
  const votes = new Map<number, number>();
  for (const r of reads) if (r.maxContainerSize) votes.set(r.maxContainerSize, (votes.get(r.maxContainerSize) ?? 0) + 1);
  const ranked = [...votes.entries()].sort((a, b) => b[1] - a[1]);
  if (!ranked.length || (ranked[1] && ranked[1][1] === ranked[0][1])) return undefined;
  return ranked[0][0];
}

export type Delivery = { commodity: string; location: string; scu: number; locationRaw?: string };
export type Collection = { commodity: string; location: string; scu: number; locationRaw?: string };

function finalize(
  base: {
    reward: number;
    corporation: string;
    lines: string[];
    suggestedPickup: string | null;
    expectedDelivers?: number;
    expectedCollects?: number;
    maxContainerSize?: number;
  },
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

  // Objective lines that were seen but could not be read (e.g. hidden by a glare or lens flare)
  // must not let a partial contract look complete.
  const hiddenDelivers = Math.max(0, (base.expectedDelivers ?? 0) - delivers.length);
  const hiddenCollects = Math.max(0, (base.expectedCollects ?? 0) - collects.length);

  const warnings: string[] = [];
  if (hiddenDelivers) warnings.push(`${hiddenDelivers} delivery line(s) could not be read (covered or blurry?)`);
  if (hiddenCollects) warnings.push(`${hiddenCollects} pickup line(s) could not be read (covered or blurry?)`);
  if (!delivers.length) warnings.push("no delivery objectives read");
  if (!collects.length && delivers.length) warnings.push("no pickup lines read");
  if (missingPickups.length) warnings.push(`no pickup read for: ${missingPickups.join(", ")}`);
  if (orphanCollects.length) warnings.push(`no matching delivery read for pickup: ${orphanCollects.join(", ")}`);
  if (unknownLocations.length) warnings.push(`unrecognized location: ${unknownLocations.join("; ")}`);

  const complete =
    delivers.length > 0 &&
    collects.length > 0 &&
    hiddenDelivers === 0 &&
    hiddenCollects === 0 &&
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
    expectedDelivers: base.expectedDelivers ?? 0,
    suggestedUsed,
    complete,
    maxContainerSize: base.maxContainerSize as number | undefined,
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
    if (loc.name && loc.listed !== false) suggestedPickup = loc.name;
  }

  const delivers: Delivery[] = [];
  const collects: Collection[] = [];

  // Deliver <done>/<total> SCU of <commodity> to <location>  ("0" is often read as "O")
  const deliverRe = /deliver\s*[0-9OoIl]+\s*\/\s*([0-9OoIl]+)\s*SCU\s*of\s*([a-z][a-z' ]{1,40}?)\s+to\s*/gi;
  let m: RegExpExecArray | null;
  while ((m = deliverRe.exec(full)) !== null) {
    const scu = parseInt(m[1].replace(/[Oo]/g, "0").replace(/[Il]/g, "1"), 10);
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

  // The word "Collect" is often garbled; a line "<commodity> from <place>" for a commodity that is
  // being delivered is still a pickup.
  for (const d of delivers) {
    if (collects.some((c) => c.commodity === d.commodity)) continue;
    const esc = d.commodity.replace(/[^a-z' ]/g, "").replace(/ /g, "\\s+");
    const fm = new RegExp(`${esc}\\s+from\\s+`, "i").exec(full);
    if (!fm) continue;
    const loc = matchLocation(windowAfter(full, fm.index + fm[0].length), knownLocations);
    collects.push({ commodity: d.commodity, location: loc.name, scu: 0, locationRaw: loc.raw });
  }

  const expectedDelivers = (full.match(/\bdeliver\s*[0-9OoIl]+\s*\/\s*[0-9OoIl]+/gi) ?? []).length;
  const expectedCollects = (text.match(/(?:^|\n)[^A-Za-z0-9\n]*collect\b/gi) ?? []).length;
  return finalize(
    {
      reward,
      corporation,
      lines: text.split(/\n+/),
      suggestedPickup,
      expectedDelivers,
      expectedCollects,
      maxContainerSize: parseMaxContainerSize(full),
    },
    delivers,
    collects
  );
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
    {
      reward: r.reward,
      corporation: r.corporation,
      lines: r.lines,
      suggestedPickup: r.suggestedPickup,
      expectedDelivers: r.delivers.length,
      maxContainerSize: r.maxContainerSize,
    },
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
  // A read that saw more objective lines than it could parse is not trustworthy.
  const seen = Math.max(0, ...reads.map((r) => r.expectedDelivers));
  const complete = reads.filter((r) => r.complete && r.delivers.length >= seen);
  if (complete.length === 0) return { chosen: null, state: "none", detail: "" };
  const groups = new Map<string, ParsedContract[]>();
  for (const r of complete) {
    const k = signature(r);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const best = [...groups.values()].sort((a, b) => b.length - a.length)[0];
  // The briefing sentence with the max container size may only be legible in some passes.
  const withMax = (r: ParsedContract): ParsedContract =>
    r.maxContainerSize ? r : { ...r, maxContainerSize: voteMaxContainerSize(reads) };
  if (best.length >= 2) return { chosen: withMax(best[0]), state: "agreed", detail: "" };
  if (reads.length === 1 && groups.size === 1) return { chosen: withMax(best[0]), state: "single", detail: "" };
  const parts = [...groups.values()].map((g) => g[0].delivers.map((d) => `${d.commodity} ${d.scu}`).join(", "));
  return { chosen: null, state: "conflict", detail: parts.join(" vs ") };
}


// ---------------------------------------------------------------------------------------------
// Voting across OCR passes. Each pass garbles different lines, so no single pass is complete.
// Vote per objective (commodity cluster) on its quantity and locations instead.
// ---------------------------------------------------------------------------------------------
type Vote = Map<string, number>;
const bump = (v: Vote, k: string) => v.set(k, (v.get(k) ?? 0) + 1);

function winner(v: Vote, minVotes: number): { value: string } | { conflict: string } | null {
  const ranked = [...v.entries()].sort((a, b) => b[1] - a[1]);
  if (!ranked.length || ranked[0][1] < minVotes) return null;
  if (ranked[1] && ranked[1][1] === ranked[0][1]) return { conflict: ranked.slice(0, 2).map((r) => r[0]).join(" vs ") };
  return { value: ranked[0][0] };
}

export type Merged = { chosen: ParsedContract | null; detail: string };

export function mergeReads(reads: ParsedContract[]): Merged {
  if (reads.length < 2) return { chosen: null, detail: "" };
  const minVotes = 2;

  // Cluster commodity spellings across passes ("distllled spirits" ~ "distilled spirits").
  const spellings = new Map<string, number>();
  for (const r of reads) for (const x of [...r.delivers, ...r.collects]) bump(spellings, x.commodity);
  const reps: string[] = [];
  for (const [name] of [...spellings.entries()].sort((a, b) => b[1] - a[1])) {
    const near = reps.find((rep) => rep === name || (Math.min(rep.length, name.length) >= 5 && lev(rep, name) <= 2));
    if (!near) reps.push(name);
  }
  const cluster = (c: string) =>
    reps.find((rep) => rep === c || (Math.min(rep.length, c.length) >= 5 && lev(rep, c) <= 2)) ?? c;

  type Acc = { dN: number; cN: number; scu: Vote; dLoc: Vote; cLoc: Vote };
  const acc = new Map<string, Acc>();
  const get = (k: string) => {
    if (!acc.has(k)) acc.set(k, { dN: 0, cN: 0, scu: new Map(), dLoc: new Map(), cLoc: new Map() });
    return acc.get(k)!;
  };
  for (const r of reads) {
    const seenD = new Set<string>();
    const seenC = new Set<string>();
    for (const d of r.delivers) {
      const k = cluster(d.commodity);
      if (seenD.has(k)) continue;
      seenD.add(k);
      const a = get(k);
      a.dN++;
      bump(a.scu, String(d.scu));
      if (d.location) bump(a.dLoc, d.location);
    }
    for (const c of r.collects) {
      const k = cluster(c.commodity);
      if (seenC.has(k)) continue;
      seenC.add(k);
      const a = get(k);
      a.cN++;
      if (c.location) bump(a.cLoc, c.location);
    }
  }

  const delivers: Delivery[] = [];
  const collects: Collection[] = [];
  const problems: string[] = [];
  for (const [commodity, a] of acc) {
    if (a.dN < minVotes && a.cN < minVotes) continue; // one-off garbage line
    const scu = winner(a.scu, minVotes);
    const dLoc = winner(a.dLoc, minVotes);
    const cLoc = winner(a.cLoc, minVotes);
    if (!scu) problems.push(`${commodity}: quantity not read twice`);
    else if ("conflict" in scu) problems.push(`${commodity} quantity ${scu.conflict}`);
    if (!dLoc) problems.push(`${commodity}: delivery place not read twice`);
    else if ("conflict" in dLoc) problems.push(`${commodity} delivery place ${dLoc.conflict}`);
    if (!cLoc) problems.push(`${commodity}: pickup not read twice`);
    else if ("conflict" in cLoc) problems.push(`${commodity} pickup ${cLoc.conflict}`);
    if (scu && "value" in scu && dLoc && "value" in dLoc && cLoc && "value" in cLoc) {
      delivers.push({ commodity, location: dLoc.value, scu: Number(scu.value) });
      collects.push({ commodity, location: cLoc.value, scu: 0 });
    }
  }
  const seen = Math.max(0, ...reads.map((r) => r.expectedDelivers));
  if (delivers.length < seen) problems.push(`${seen} objectives visible but only ${delivers.length} read twice`);
  if (problems.length || delivers.length === 0) return { chosen: null, detail: problems.join("; ") };

  const base = reads.find((r) => r.reward && r.corporation) ?? reads.find((r) => r.reward) ?? reads[0];
  const rewardVotes: Vote = new Map();
  for (const r of reads) if (r.reward) bump(rewardVotes, String(r.reward));
  const reward = winner(rewardVotes, 1);
  const merged = finalize(
    {
      reward: reward && "value" in reward ? Number(reward.value) : base.reward,
      corporation: base.corporation,
      lines: base.lines,
      suggestedPickup: base.suggestedPickup,
      maxContainerSize: voteMaxContainerSize(reads),
    },
    delivers,
    collects
  );
  return { chosen: merged, detail: "" };
}
