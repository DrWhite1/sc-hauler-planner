// Pure helpers for the mission Edit panel (no React), so they can be tested with plain node.
import type { Leg } from "./parseContract";

type EditableMission = { pickup: string; dropoff: string; legs?: Leg[] };

// Change the place of one stop (leg) of a mission.
export function setLegLocation<M extends EditableMission>(m: M, index: number, location: string): M {
  if (!m.legs || index < 0 || index >= m.legs.length) return m;
  return { ...m, legs: m.legs.map((l, i) => (i === index ? { ...l, location } : l)) };
}

// The mission card shows "pickup → dropoff"; with legs these are a summary of the leg places
// ("A + B"), so rebuild them after the legs changed. Stops without a place are left out.
export function summarizeLegs<M extends EditableMission>(m: M): M {
  if (!m.legs || m.legs.length === 0) return m;
  const uniq = (t: Leg["type"]) => [...new Set(m.legs!.filter((l) => l.type === t && l.location).map((l) => l.location))];
  const pickups = uniq("pickup");
  const dropoffs = uniq("dropoff");
  return {
    ...m,
    pickup: pickups.slice(0, 4).join(" + ") || m.pickup,
    dropoff: dropoffs.slice(0, 4).join(" + ") || m.dropoff,
  };
}

// Stops that still need a place (e.g. a pickup the OCR could not read).
export function stopsWithoutPlace(m: EditableMission): number[] {
  return (m.legs ?? []).flatMap((l, i) => (l.location ? [] : [i]));
}
