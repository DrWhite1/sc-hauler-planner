import { create } from "zustand";
import { persist } from "zustand/middleware";
import { findShip, type Ship } from "./ships";

export type Leg = {
  type: "pickup" | "dropoff";
  location: string;
  scu: number;
  commodity?: string;
  scuEstimated?: boolean; // even split of a delivery over several pickups (amount not stated)
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
  availableMinutes?: number;
  addedAt?: number;
  maxContainerSize?: number;
};

export type VoiceCommand = {
  id: string;
  phrase: string;
  key: string;
  duration?: number;
};

type State = {
  selectedShip: Ship | null;
  currentLocation: string;
  missions: Mission[];
  completedStops: string[];
  voiceCommands: VoiceCommand[];
  gridFit: boolean; // cargo grid: true = fit to window, false = actual size (scroll)
  setGridFit: (fit: boolean) => void;
  setShip: (ship: Ship | null) => void;
  setCurrentLocation: (loc: string) => void;
  addMission: (mission: Omit<Mission, "id">) => void;
  updateMission: (id: string, updates: Partial<Mission>) => void;
  removeMission: (id: string) => void;
  clearMissions: () => void;
  toggleStop: (key: string) => void;
  clearProgress: () => void;
  setVoiceCommands: (cmds: VoiceCommand[]) => void;
  addVoiceCommand: (phrase: string, key: string, duration?: number) => void;
  removeVoiceCommand: (id: string) => void;
};

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

const defaultVoice: VoiceCommand[] = [
  { id: "1", phrase: "open doors", key: "o" },
  { id: "2", phrase: "close doors", key: "o" },
  { id: "3", phrase: "request docking", key: "n" },
  { id: "4", phrase: "landing gear", key: "n" },
  { id: "5", phrase: "quantum drive", key: "b" },
  { id: "6", phrase: "exit seat", key: "y" },
];

export const useHaulerStore = create<State>()(
  persist(
    (set) => ({
      selectedShip: null,
      currentLocation: "",
      missions: [],
      completedStops: [],
      voiceCommands: defaultVoice,
      gridFit: true,
      setGridFit: (fit) => set({ gridFit: fit }),
      setShip: (ship) => set({ selectedShip: ship }),
      setCurrentLocation: (loc) => set({ currentLocation: loc }),
      addMission: (mission) =>
        set((state) => ({
          missions: [
            ...state.missions,
            { ...mission, id: generateId(), addedAt: Date.now() },
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
          completedStops: state.completedStops.filter((k) => !k.startsWith(id + ":")),
        })),
      clearMissions: () => set({ missions: [], completedStops: [] }),
      toggleStop: (key) =>
        set((state) => ({
          completedStops: state.completedStops.includes(key)
            ? state.completedStops.filter((k) => k !== key)
            : [...state.completedStops, key],
        })),
      clearProgress: () => set({ completedStops: [] }),
      setVoiceCommands: (cmds) => set({ voiceCommands: cmds }),
      addVoiceCommand: (phrase, key, duration) =>
        set((state) => ({
          voiceCommands: [...state.voiceCommands, { id: generateId(), phrase, key, duration }],
        })),
      removeVoiceCommand: (id) =>
        set((state) => ({
          voiceCommands: state.voiceCommands.filter((c) => c.id !== id),
        })),
    }),
    {
      name: "sc-hauler-store",
      // The whole Ship object is saved, so refresh it from the current ship list on load.
      // Otherwise corrected capacities would never reach people who picked a ship before.
      merge: (persisted, current) => {
        const saved = (persisted || {}) as Partial<State>;
        return {
          ...current,
          ...saved,
          selectedShip: saved.selectedShip ? findShip(saved.selectedShip.id) : current.selectedShip,
        };
      },
    }
  )
);