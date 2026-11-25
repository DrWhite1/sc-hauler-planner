import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Ship } from "./ships";

export type Mission = {
  id: string;
  pickup: string;
  dropoff: string;
  reward: number;
  scu: number;
  corporation?: string;
  rank?: string;
};

type State = {
  selectedShip: Ship | null;
  missions: Mission[];
  setShip: (ship: Ship | null) => void;
  addMission: (mission: Omit<Mission, "id">) => void;
  removeMission: (id: string) => void;
  clearMissions: () => void;
};

export const useHaulerStore = create<State>()(
  persist(
    (set) => ({
      selectedShip: null,
      missions: [],
      setShip: (ship) => set({ selectedShip: ship }),
      addMission: (mission) =>
        set((state) => ({
          missions: [
            ...state.missions,
            { ...mission, id: crypto.randomUUID() },
          ],
        })),
      removeMission: (id) =>
        set((state) => ({
          missions: state.missions.filter((m) => m.id !== id),
        })),
      clearMissions: () => set({ missions: [] }),
    }),
    { name: "sc-hauler-store" }
  )
);