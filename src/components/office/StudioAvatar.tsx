import { useState } from "react";
import type { AgentType } from "../../types";
import { STUDIO_AGENTS } from "./studioAgents";

/** A decorative identity image. Its surrounding control supplies name and status. */
export function StudioAvatar({
  role,
  portrait = false,
}: {
  role: AgentType;
  portrait?: boolean;
}) {
  const source = STUDIO_AGENTS[role].source;
  const [failedSource, setFailedSource] = useState<string | null>(null);
  return (
    <span
      className={`studio-avatar ${portrait ? "is-portrait" : ""}`}
      aria-hidden="true"
    >
      {failedSource === source ? (
        <span className="studio-avatar-fallback">
          {role.slice(0, 2).toUpperCase()}
        </span>
      ) : (
        <img
          src={source}
          width="384"
          height="384"
          alt=""
          draggable={false}
          decoding="async"
          onError={() => setFailedSource(source)}
        />
      )}
    </span>
  );
}
