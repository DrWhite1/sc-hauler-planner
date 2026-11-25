import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Ship } from "./ships";
import type { Corporation, Rank } from "./progression";

export type Leg = {
  type: "pickup" | "dropoff";
  location: string;
  scu: number;
  commodity?: string;
};

export type Mission = {
  id: string;
  pickup: string;
  dropoff: string;
  reward: number;
  scu: number;
  corporation?: string;
  rank?: string;
  legs?: Leg[];
};

export type CorpProgress = {
  rank: Rank;
  xp: number;
};

type State = {
  selectedShip: Ship | null;
  currentLocation: string;
  missions: Mission[];
  progression: Record<Corporation, CorpProgress>;
  setShip: (ship: Ship | null) => void;
  setCurrentLocation: (loc: string) => void;
  addMission: (mission: Omit<Mission, "id">) => void;
  updateMission: (id: string, updates: Partial<Mission>) => void;
  removeMission: (id: string) => void;
  clearMissions: () => void;
  setCorpRank: (corp: Corporation, rank: Rank) => void;
  addXp: (corp: Corporation, amount: number) => void;
};

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

const defaultProgress = (): Record<Corporation, CorpProgress> => ({
  Covalex: { rank: "Trainee", xp: 0 },
  "Ling Family": { rank: "Trainee", xp: 0 },
  "Red Wind": { rank: "Trainee", xp: 0 },
});

export const useHaulerStore = create<State>()(
  persist(
    (set) => ({
      selectedShip: null,
      currentLocation: "",
      missions: [],
      progression: defaultProgress(),
      setShip: (ship) => set({ selectedShip: ship }),
      setCurrentLocation: (loc) => set({ currentLocation: loc }),
      addMission: (mission) =>
        set((state) => ({
          missions: [
            ...state.missions,
            { ...mission, id: generateId() },
          ],
        })),
      updateMission: (id, updates) =>
        set((state) => ({
          missions: state.missions.map((m) =>
            m.id === id ? { ...m, ...updates } : m
          ),
        })),
      removeMission: (id) =>
        set((state) => ({
          missions: state.missions.filter((m) => m.id !== id),
        })),
      clearMissions: () => set({ missions: [] }),
      setCorpRank: (corp, rank) =>
        set((state) => ({
          progression: {
            ...state.progression,
            [corp]: { ...state.progression[corp], rank },
          },
        })),
      addXp: (corp, amount) =>
        set((state) => {
          const current = state.progression[corp] || { rank: "Trainee" as Rank, xp: 0 };
          return {
            progression: {
              ...state.progression,
              [corp]: { ...current, xp: current.xp + amount },
            },
          };
        }),
    }),
    { name: "sc-hauler-store" }
  )
);