import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  showInbox: boolean;
  showTimeline: boolean;
  showOffice: boolean;
  officeView: "studio" | "pixel";
  officeMotion: boolean;
  toggleInbox: () => void;
  toggleTimeline: () => void;
  toggleOffice: () => void;
  setOfficeView: (view: "studio" | "pixel") => void;
  toggleOfficeMotion: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      showInbox: true,
      showTimeline: true,
      showOffice: true,
      officeView: "studio",
      officeMotion: true,
      toggleInbox: () => set((state) => ({ showInbox: !state.showInbox })),
      toggleTimeline: () =>
        set((state) => ({ showTimeline: !state.showTimeline })),
      toggleOffice: () => set((state) => ({ showOffice: !state.showOffice })),
      setOfficeView: (officeView) => set({ officeView }),
      toggleOfficeMotion: () =>
        set((state) => ({ officeMotion: !state.officeMotion })),
    }),
    { name: "codex-office-settings", version: 1 },
  ),
);
