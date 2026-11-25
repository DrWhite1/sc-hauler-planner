export type Ship = {
  id: string;
  name: string;
  scu: number;
  maxContainer: number;
};

export const SHIPS: Ship[] = [
  { id: "avenger-titan", name: "Avenger Titan", scu: 8, maxContainer: 4 },
  { id: "nomad", name: "Nomad", scu: 24, maxContainer: 8 },
  { id: "cutlass-black", name: "Cutlass Black", scu: 46, maxContainer: 16 },
  { id: "c1-spirit", name: "C1 Spirit", scu: 64, maxContainer: 32 },
  { id: "zeus-cl", name: "Zeus Mk II CL", scu: 128, maxContainer: 32 },
  { id: "freelancer", name: "Freelancer", scu: 66, maxContainer: 16 },
  { id: "freelancer-max", name: "Freelancer MAX", scu: 120, maxContainer: 32 },
  { id: "constellation-taurus", name: "Constellation Taurus", scu: 174, maxContainer: 32 },
  { id: "raft", name: "RAFT", scu: 192, maxContainer: 32 },
  { id: "corsair", name: "Corsair", scu: 72, maxContainer: 32 },
  { id: "caterpillar", name: "Caterpillar", scu: 576, maxContainer: 32 },
  { id: "starlancer-max", name: "Starlancer MAX", scu: 224, maxContainer: 32 },
  { id: "c2-hercules", name: "C2 Hercules", scu: 696, maxContainer: 32 },
  { id: "m2-hercules", name: "M2 Hercules", scu: 468, maxContainer: 32 },
  { id: "hull-a", name: "Hull A", scu: 64, maxContainer: 16 },
  { id: "hull-c", name: "Hull C", scu: 4608, maxContainer: 32 },
  { id: "carrack", name: "Carrack", scu: 456, maxContainer: 16 },
  { id: "ironclad", name: "Ironclad", scu: 2200, maxContainer: 32 },
];