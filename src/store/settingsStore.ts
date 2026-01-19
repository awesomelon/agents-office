import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  showInbox: boolean;
  showTimeline: boolean;
  animationSpeed: number;
  soundEnabled: boolean;
  theme: "dark" | "light";
  toggleInbox: () => void;
  toggleTimeline: () => void;
  setAnimationSpeed: (speed: number) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setTheme: (theme: "dark" | "light") => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      showInbox: true,
      showTimeline: true,
      animationSpeed: 1,
      soundEnabled: false,
      theme: "dark",

      toggleInbox: () => {
        set((state) => ({ showInbox: !state.showInbox }));
      },

      toggleTimeline: () => {
        set((state) => ({ showTimeline: !state.showTimeline }));
      },

      setAnimationSpeed: (speed) => {
        set({ animationSpeed: speed });
      },

      setSoundEnabled: (enabled) => {
        set({ soundEnabled: enabled });
      },

      setTheme: (theme) => {
        set({ theme });
      },
    }),
    {
      name: "agents-office-settings",
    }
  )
);
