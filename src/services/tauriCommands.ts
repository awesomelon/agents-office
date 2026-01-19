import { invoke } from "@tauri-apps/api/core";
import type { Agent } from "../types";

export async function getClaudeHome(): Promise<string> {
  return invoke<string>("get_claude_home");
}

export async function getAgents(): Promise<Agent[]> {
  return invoke<Agent[]>("get_agents");
}

export async function startWatching(): Promise<boolean> {
  return invoke<boolean>("start_watching");
}

export async function stopWatching(): Promise<boolean> {
  return invoke<boolean>("stop_watching");
}
