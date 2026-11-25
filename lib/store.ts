import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Ship } from "./ships";

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

type State = {
  selectedShip: Ship | null;
  currentLocation: string;
  missions: Mission[];
  setShip: (ship: Ship | null) => void;
  setCurrentLocation: (loc: string) => void;
  addMission: (mission: Omit<Mission, "id">) => void;
  updateMission: (id: string, updates: Partial<Mission>) => void;
  removeMission: (id: string) => void;
  clearMissions: () => void;
};

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export const useHaulerStore = create<State>()(
  persist(
    (set) => ({
      selectedShip: null,
      currentLocation: "",
      missions: [],
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
    }),
    { name: "sc-hauler-store" }
  )
);