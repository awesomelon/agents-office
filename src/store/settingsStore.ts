import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  showInbox: boolean;
  showTimeline: boolean;
  showOffice: boolean;
  toggleInbox: () => void;
  toggleTimeline: () => void;
  toggleOffice: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      showInbox: true,
      showTimeline: true,
      showOffice:
        typeof matchMedia === "undefined" ||
        !matchMedia("(prefers-reduced-motion: reduce)").matches,
      toggleInbox: () => set((state) => ({ showInbox: !state.showInbox })),
      toggleTimeline: () =>
        set((state) => ({ showTimeline: !state.showTimeline })),
      toggleOffice: () => set((state) => ({ showOffice: !state.showOffice })),
    }),
    { name: "codex-office-settings", version: 1 },
  ),
);
