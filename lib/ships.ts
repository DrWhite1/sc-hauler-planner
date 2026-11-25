export type Ship = {
  id: string;
  name: string;
  scu: number;
  maxContainer: number;
};

export const SHIPS: Ship[] = [
  { id: "cutlass-black", name: "Cutlass Black", scu: 46, maxContainer: 16 },
  { id: "c1-spirit", name: "C1 Spirit", scu: 64, maxContainer: 32 },
  { id: "freelancer-max", name: "Freelancer MAX", scu: 120, maxContainer: 32 },
  { id: "constellation-taurus", name: "Constellation Taurus", scu: 174, maxContainer: 32 },
  { id: "c2-hercules", name: "C2 Hercules", scu: 696, maxContainer: 32 },
  { id: "hull-c", name: "Hull C", scu: 4608, maxContainer: 32 },
  { id: "caterpillar", name: "Caterpillar", scu: 576, maxContainer: 32 },
];