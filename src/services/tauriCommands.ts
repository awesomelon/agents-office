import { invoke, isTauri } from "@tauri-apps/api/core";
import type { ObserverSnapshot } from "../types";

export const isDesktop = (): boolean => isTauri();

export function getObserverSnapshot(): Promise<ObserverSnapshot> {
  return invoke<ObserverSnapshot>("get_observer_snapshot");
}
