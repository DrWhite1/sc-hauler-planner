export type Ship = {
  id: string;
  name: string;
  scu: number; // total cargo grid capacity in SCU (1 SCU = one grid square)
  maxContainer: number; // largest container the ship's grid takes, in SCU
  concept?: boolean; // not flyable in the live game yet (RSI concept numbers)
};

// Cargo capacities checked against Star Citizen 4.10.3-LIVE game data
// (Star Citizen Wiki API / starcitizen.tools) and UEX Corp (uexcorp.space), November 2026.
// Where the two disagreed the in-game value was used. Max container sizes for Nomad, C1,
// Andromeda, Zeus CL, RAFT, Railen, Hull B/C, Caterpillar, Golem OX and Ironclad were verified
// in game (4.10.3, Nov 2026). Sorted by capacity.
export const SHIPS: Ship[] = [
  { id: "mpuv-cargo", name: "MPUV Cargo", scu: 2, maxContainer: 2 },
  { id: "avenger-titan", name: "Avenger Titan", scu: 8, maxContainer: 4 },
  { id: "cutlass-red", name: "Cutlass Red", scu: 12, maxContainer: 2 },
  { id: "cutlass-blue", name: "Cutlass Blue", scu: 12, maxContainer: 2 },
  { id: "vulture", name: "Vulture", scu: 12, maxContainer: 8 },
  { id: "nomad", name: "Nomad", scu: 24, maxContainer: 8 },
  { id: "hyun", name: "Gatac Hyūn", scu: 32, maxContainer: 8 },
  { id: "freelancer-dur", name: "Freelancer DUR", scu: 36, maxContainer: 16 },
  { id: "400i", name: "400i", scu: 42, maxContainer: 24 },
  { id: "cutlass-black", name: "Cutlass Black", scu: 46, maxContainer: 16 },
  { id: "c1-spirit", name: "C1 Spirit", scu: 64, maxContainer: 16 },
  { id: "golem-ox", name: "Golem OX", scu: 64, maxContainer: 16 },
  { id: "hull-a", name: "Hull A", scu: 64, maxContainer: 16 },
  { id: "freelancer", name: "Freelancer", scu: 66, maxContainer: 16 },
  { id: "corsair", name: "Corsair", scu: 72, maxContainer: 32 },
  { id: "valkyrie", name: "Valkyrie", scu: 90, maxContainer: 24 },
  { id: "andromeda", name: "Constellation Andromeda", scu: 96, maxContainer: 32 },
  { id: "perseus", name: "Perseus", scu: 96, maxContainer: 32 },
  { id: "mercury", name: "Mercury Star Runner", scu: 114, maxContainer: 32 },
  { id: "freelancer-max", name: "Freelancer MAX", scu: 120, maxContainer: 32 },
  { id: "zeus-cl", name: "Zeus Mk II CL", scu: 128, maxContainer: 16 },
  { id: "constellation-taurus", name: "Constellation Taurus", scu: 174, maxContainer: 32 },
  // Added Nov 2026. Capacity: Star Citizen Wiki API 4.10.3-LIVE. Max container: FleetYards compare pages and the
  // community cargo grid chart for 4.10.2 (ratjack.net) agree; where they differ from the wiki grid data the two agree with each other.
  // 24 is not a container the app packs; it is floored to 16 when splitting.
  { id: "asgard", name: "Asgard", scu: 180, maxContainer: 32 },
  { id: "raft", name: "RAFT", scu: 192, maxContainer: 32 },
  { id: "a2-hercules", name: "A2 Hercules", scu: 216, maxContainer: 32 },
  { id: "starlancer-max", name: "Starlancer MAX", scu: 224, maxContainer: 32 },
  { id: "centaurus", name: "Constellation Mk V Centaurus", scu: 240, maxContainer: 32 },
  { id: "hermes", name: "Hermes", scu: 288, maxContainer: 32 },
  { id: "starfarer", name: "Starfarer", scu: 291, maxContainer: 24 },
  { id: "890-jump", name: "890 Jump", scu: 388, maxContainer: 32 },
  { id: "liberator", name: "Liberator", scu: 400, maxContainer: 32 },
  { id: "reclaimer", name: "Reclaimer", scu: 420, maxContainer: 16 },
  { id: "carrack", name: "Carrack", scu: 456, maxContainer: 16 },
  { id: "hull-b", name: "Hull B", scu: 512, maxContainer: 32 },
  { id: "m2-hercules", name: "M2 Hercules", scu: 522, maxContainer: 32 },
  { id: "polaris", name: "Polaris", scu: 576, maxContainer: 32 },
  { id: "caterpillar", name: "Caterpillar", scu: 576, maxContainer: 16 },
  { id: "railen", name: "Railen", scu: 640, maxContainer: 32 },
  { id: "c2-hercules", name: "C2 Hercules", scu: 696, maxContainer: 32 },
  // 64 SCU in the rear hangar + 656 SCU in the Cargo module (4.10.3).
  { id: "galaxy", name: "Galaxy (Cargo module)", scu: 720, maxContainer: 32 },
  { id: "ironclad-assault", name: "Ironclad Assault", scu: 1440, maxContainer: 32 }, // 32 confirmed by the user
  { id: "ironclad", name: "Ironclad", scu: 2200, maxContainer: 32 },
  { id: "merchantman", name: "Banu Merchantman", scu: 2880, maxContainer: 32, concept: true },
  { id: "hull-c", name: "Hull C", scu: 4608, maxContainer: 32 },
  { id: "hull-d", name: "Hull D", scu: 6912, maxContainer: 32, concept: true },
  { id: "hull-e", name: "Hull E", scu: 12288, maxContainer: 32, concept: true },
];

export function findShip(id: string | undefined | null): Ship | null {
  if (!id) return null;
  return SHIPS.find((s) => s.id === id) ?? null;
}
