export const CORPORATIONS = ["Covalex", "Ling Family", "Red Wind"] as const;
export type Corporation = (typeof CORPORATIONS)[number];

export const RANKS = [
  "Trainee",
  "Rookie",
  "Junior",
  "Member",
  "Experienced",
  "Senior",
  "Master",
] as const;
export type Rank = (typeof RANKS)[number];

export const RANK_THRESHOLDS: Record<Rank, number> = {
  Trainee: 0,
  Rookie: 100,
  Junior: 400,
  Member: 1000,
  Experienced: 2500,
  Senior: 5000,
  Master: 10000,
};