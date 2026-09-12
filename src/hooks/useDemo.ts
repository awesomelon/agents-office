import { useCallback, useEffect, useState } from "react";
import {
  DESK_CONFIGS,
  type Agent,
  type AgentType,
  type LogEntry,
} from "../types";
import {
  processObservedBatch,
  resetObserverActivity,
} from "../services/observerState";
import { isDesktop } from "../services/tauriCommands";

interface DemoStep {
  type: LogEntry["entry_type"];
  role?: AgentType;
  tool?: string;
  call?: string;
  content: string;
}
const DEMO: DemoStep[] = [
  {
    type: "session_start",
    content: "Demo session opened. All events in this preview are synthetic.",
  },
  { type: "task_start", content: "Demo turn started." },
  {
    type: "tool_call",
    role: "architect",
    tool: "update_plan",
    call: "plan",
    content: "Plan updated · arguments hidden",
  },
  {
    type: "tool_result",
    role: "architect",
    tool: "update_plan",
    call: "plan",
    content: "Tool completed · output hidden",
  },
  {
    type: "tool_call",
    role: "explorer",
    tool: "exec_command",
    call: "read",
    content: "File inspection · command hidden",
  },
  {
    type: "tool_result",
    role: "explorer",
    tool: "exec_command",
    call: "read",
    content: "Tool completed · output hidden",
  },
  {
    type: "tool_call",
    role: "developer",
    tool: "apply_patch",
    call: "patch",
    content: "Patch requested · source code hidden",
  },
  {
    type: "tool_result",
    role: "developer",
    tool: "apply_patch",
    call: "patch",
    content: "Tool completed · output hidden",
  },
  {
    type: "tool_call",
    role: "validator",
    tool: "exec_command",
    call: "test1",
    content: "Verification command · command hidden",
  },
  {
    type: "error",
    role: "validator",
    tool: "exec_command",
    call: "test1",
    content: "Demo verification failed · error output hidden",
  },
  {
    type: "tool_call",
    role: "validator",
    tool: "exec_command",
    call: "test2",
    content: "Verification retried · command hidden",
  },
  {
    type: "tool_result",
    role: "validator",
    tool: "exec_command",
    call: "test2",
    content: "Tool completed · output hidden",
  },
  {
    type: "task_complete",
    content:
      "Demo turn completed. Watching logs does not execute or control Codex.",
  },
];

export function useDemo() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const next = useCallback(() => {
    if (isDesktop() || step >= DEMO.length) {
      setPlaying(false);
      return;
    }
    const item = DEMO[step];
    const entry: LogEntry = {
      id: `demo-${step}`,
      timestamp: new Date().toISOString(),
      entry_type: item.type,
      content: item.content,
      agent_id: "demo-session",
      session_id: "demo-session",
      agent_type: item.role ?? null,
      tool_name: item.tool ?? null,
      call_id: item.call ?? null,
    };
    const agents: Agent[] = item.role
      ? DESK_CONFIGS.filter((desk) => desk.id === item.role).map((desk) => ({
          id: desk.id,
          agent_type: desk.agentType,
          desk_position: desk.position,
          status:
            item.type === "tool_call"
              ? "working"
              : item.type === "error"
                ? "error"
                : "idle",
          current_task: item.content,
        }))
      : [];
    processObservedBatch([entry], agents);
    setStep(step + 1);
    if (step + 1 >= DEMO.length) setPlaying(false);
  }, [step]);
  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(next, 1400);
    return () => clearTimeout(timer);
  }, [playing, next]);
  const reset = () => {
    setPlaying(false);
    setStep(0);
    resetObserverActivity();
  };
  return {
    step,
    total: DEMO.length,
    playing,
    next,
    reset,
    toggle: () => setPlaying((value) => !value),
  };
}
