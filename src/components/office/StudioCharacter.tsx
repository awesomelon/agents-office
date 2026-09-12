import type { CSSProperties } from "react";
import type { AgentStatus, AgentType } from "../../types";
import { StudioAvatar } from "./StudioAvatar";
import { STUDIO_AGENTS, studioAgentState } from "./studioAgents";
import { STUDIO_STATUS } from "./studioLayout";

export function StudioCharacter({
  role,
  label,
  index,
  status,
  rateLimited,
  selected,
  onSelect,
}: {
  role: AgentType;
  label: string;
  index: number;
  status: AgentStatus;
  rateLimited: boolean;
  selected: boolean;
  onSelect: (role: AgentType) => void;
}) {
  const design = STUDIO_AGENTS[role];
  const state = studioAgentState(status, rateLimited);
  const statusText = rateLimited ? "Rate limited" : STUDIO_STATUS[status];
  const number = String(index + 1).padStart(2, "0");
  return (
    <div
      className={`studio-character studio-status-${status} ${selected ? "is-selected" : ""}`}
      data-role={role}
      data-state={state}
      style={
        {
          left: `${design.x}%`,
          top: `${design.y}%`,
          width: `${design.width}%`,
          "--character-depth": Math.round(design.y),
        } as CSSProperties
      }
    >
      <span className="studio-character-ground" aria-hidden="true" />
      <span className="studio-character-body">
        <StudioAvatar role={role} />
      </span>
      <span className="studio-character-badge" aria-hidden="true">
        {state === "error" ? "!" : state === "limited" ? "II" : number}
      </span>
      <button
        type="button"
        className="studio-character-target"
        aria-label={`${label}: ${statusText}`}
        aria-pressed={selected}
        aria-controls="studio-role-detail"
        onClick={() => onSelect(role)}
      >
        <span className="studio-character-label" aria-hidden="true">
          {label}
          <small>{statusText}</small>
        </span>
      </button>
    </div>
  );
}
