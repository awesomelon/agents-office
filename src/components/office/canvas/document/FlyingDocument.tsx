import { Container, Graphics, Text } from "@pixi/react";
import { useCallback, useEffect, useMemo } from "react";
import { TextStyle } from "pixi.js";
import type { DocumentTransfer } from "../../../../store";
import { TOOL_COLORS } from "../../../../types";
import { DOCUMENT_ARC_HEIGHT, DOCUMENT_SIZE, DOCUMENT_TRANSFER_DURATION_MS } from "../constants";
import { clamp01, easeOutCubic, lerp } from "../math";
import { getAgentPosition } from "../layout";

type ToolKind = "read" | "search" | "write" | "edit" | "run" | "plan" | "other";

interface ToolStamp {
  label: string;
  color: number;
  kind: ToolKind;
}

const DEFAULT_STAMP: ToolStamp = { label: "???", color: TOOL_COLORS.other, kind: "other" };

const TOOL_STAMPS: Record<string, ToolStamp> = {
  read: { label: "READ", color: TOOL_COLORS.read, kind: "read" },
  glob: { label: "SRCH", color: TOOL_COLORS.search, kind: "search" },
  grep: { label: "SRCH", color: TOOL_COLORS.search, kind: "search" },
  websearch: { label: "SRCH", color: TOOL_COLORS.search, kind: "search" },
  webfetch: { label: "SRCH", color: TOOL_COLORS.search, kind: "search" },
  write: { label: "WRIT", color: TOOL_COLORS.write, kind: "write" },
  edit: { label: "EDIT", color: TOOL_COLORS.edit, kind: "edit" },
  notebookedit: { label: "EDIT", color: TOOL_COLORS.edit, kind: "edit" },
  editnotebook: { label: "EDIT", color: TOOL_COLORS.edit, kind: "edit" },
  bash: { label: "BASH", color: TOOL_COLORS.run, kind: "run" },
  todowrite: { label: "PLAN", color: TOOL_COLORS.plan, kind: "plan" },
  task: { label: "PLAN", color: TOOL_COLORS.plan, kind: "plan" },
};

function getToolStamp(toolName: string | null | undefined): ToolStamp {
  const tool = toolName?.trim()?.toLowerCase();
  if (!tool) return DEFAULT_STAMP;

  const stamp = TOOL_STAMPS[tool];
  if (stamp) return stamp;

  return { label: tool.slice(0, 4).toUpperCase(), color: 0x6b7280, kind: "other" };
}

// Pixel art icon rendering for each tool kind
function drawToolIcon(g: any, kind: ToolKind, color: number, cx: number, cy: number): void {
  const P = 2; // pixel size
  g.beginFill(color, 0.95);

  switch (kind) {
    case "read":
      // Open book icon (8x6 pixels)
      // Left page
      g.drawRect(cx - 4 * P, cy - 2 * P, 3 * P, 4 * P);
      // Right page
      g.drawRect(cx + 1 * P, cy - 2 * P, 3 * P, 4 * P);
      // Spine
      g.drawRect(cx - P, cy - 2 * P, 2 * P, 4 * P);
      g.endFill();
      // Page lines
      g.beginFill(0xffffff, 0.6);
      g.drawRect(cx - 3 * P, cy - P, 2 * P, P);
      g.drawRect(cx - 3 * P, cy + P, P, P);
      g.drawRect(cx + 2 * P, cy - P, 2 * P, P);
      g.drawRect(cx + 2 * P, cy + P, P, P);
      g.endFill();
      break;

    case "search":
      // Magnifying glass icon (7x7 pixels)
      // Glass circle (hollow)
      g.drawRect(cx - 2 * P, cy - 3 * P, 4 * P, P);
      g.drawRect(cx - 3 * P, cy - 2 * P, P, 3 * P);
      g.drawRect(cx + 2 * P, cy - 2 * P, P, 3 * P);
      g.drawRect(cx - 2 * P, cy + P, 4 * P, P);
      // Handle
      g.drawRect(cx + 2 * P, cy + P, P, P);
      g.drawRect(cx + 3 * P, cy + 2 * P, P, 2 * P);
      g.endFill();
      // Glass shine
      g.beginFill(0xffffff, 0.5);
      g.drawRect(cx - 2 * P, cy - 2 * P, P, P);
      g.endFill();
      break;

    case "write":
      // Pencil icon (6x8 pixels)
      // Pencil body (diagonal)
      g.drawRect(cx - 2 * P, cy - 3 * P, 2 * P, P);
      g.drawRect(cx - P, cy - 2 * P, 2 * P, P);
      g.drawRect(cx, cy - P, 2 * P, P);
      g.drawRect(cx + P, cy, 2 * P, P);
      g.drawRect(cx + 2 * P, cy + P, P, P);
      g.endFill();
      // Tip
      g.beginFill(0xfbbf24, 0.9);
      g.drawRect(cx + 3 * P, cy + 2 * P, P, P);
      g.endFill();
      // Eraser
      g.beginFill(0xfda4af, 0.9);
      g.drawRect(cx - 3 * P, cy - 3 * P, P, P);
      g.endFill();
      break;

    case "edit":
      // Document with pencil icon (7x7 pixels)
      // Document
      g.drawRect(cx - 3 * P, cy - 3 * P, 4 * P, 6 * P);
      g.endFill();
      // Pencil overlay
      g.beginFill(0xfbbf24, 0.9);
      g.drawRect(cx + P, cy - P, P, P);
      g.drawRect(cx + 2 * P, cy, P, P);
      g.drawRect(cx + 3 * P, cy + P, P, P);
      g.endFill();
      // Doc lines
      g.beginFill(0xffffff, 0.5);
      g.drawRect(cx - 2 * P, cy - 2 * P, 2 * P, P);
      g.drawRect(cx - 2 * P, cy, 2 * P, P);
      g.endFill();
      break;

    case "run":
      // Terminal/gear icon - lightning bolt (6x8 pixels)
      g.drawRect(cx - P, cy - 3 * P, 3 * P, P);
      g.drawRect(cx - 2 * P, cy - 2 * P, 3 * P, P);
      g.drawRect(cx - P, cy - P, 3 * P, P);
      g.drawRect(cx, cy, 2 * P, P);
      g.drawRect(cx - P, cy + P, 3 * P, P);
      g.drawRect(cx, cy + 2 * P, 2 * P, P);
      g.endFill();
      break;

    case "plan":
      // Checklist icon (6x7 pixels)
      // Paper
      g.drawRect(cx - 2 * P, cy - 3 * P, 5 * P, 6 * P);
      g.endFill();
      // Checkmarks
      g.beginFill(0xffffff, 0.7);
      g.drawRect(cx - P, cy - 2 * P, P, P);
      g.drawRect(cx, cy - P, P, P);
      g.drawRect(cx - P, cy + P, P, P);
      g.drawRect(cx, cy + 2 * P, P, P);
      g.endFill();
      // Lines
      g.beginFill(0x000000, 0.3);
      g.drawRect(cx + P, cy - 2 * P, 2 * P, P);
      g.drawRect(cx + P, cy + P, 2 * P, P);
      g.endFill();
      break;

    case "other":
    default:
      // Question mark icon (5x7 pixels)
      g.drawRect(cx - P, cy - 3 * P, 2 * P, P);
      g.drawRect(cx - 2 * P, cy - 2 * P, P, P);
      g.drawRect(cx + P, cy - 2 * P, P, P);
      g.drawRect(cx + P, cy - P, P, P);
      g.drawRect(cx, cy, P, P);
      g.drawRect(cx, cy + 2 * P, P, P);
      g.endFill();
      break;
  }
}

const STAMP_TEXT_STYLE = new TextStyle({
  fontFamily: '"Press Start 2P", monospace',
  fontSize: 5,
  fill: 0xffffff,
  dropShadow: true,
  dropShadowColor: 0x000000,
  dropShadowBlur: 0,
  dropShadowDistance: 1,
});

interface FlyingDocumentProps {
  transfer: DocumentTransfer;
  now: number;
  stackDepth: number;
  onComplete: (transferId: string) => void;
}

export function FlyingDocument({ transfer, now, stackDepth, onComplete }: FlyingDocumentProps): JSX.Element | null {
  const progress = clamp01((now - transfer.startedAt) / DOCUMENT_TRANSFER_DURATION_MS);

  useEffect(() => {
    if (progress >= 1) {
      onComplete(transfer.id);
    }
  }, [progress, onComplete, transfer.id]);

  if (progress >= 1) return null;

  const eased = easeOutCubic(progress);
  const from = getAgentPosition(transfer.fromAgentId);
  const to = getAgentPosition(transfer.toAgentId);

  // Arc trajectory
  const x = lerp(from.x, to.x, eased);
  const baseY = lerp(from.y, to.y, eased);
  const y = baseY - Math.sin(progress * Math.PI) * DOCUMENT_ARC_HEIGHT;

  const rotation = progress * Math.PI * 2 + stackDepth * 0.08;
  const scale = 1 + Math.sin(progress * Math.PI) * 0.3;

  const stackOffsetX = stackDepth * 2;
  const stackOffsetY = stackDepth * 1;
  const stackScale = Math.max(0.7, 1 - stackDepth * 0.05);
  const stackAlpha = Math.max(0.35, 1 - stackDepth * 0.15);

  const stamp = useMemo(() => getToolStamp(transfer.toolName), [transfer.toolName]);

  const draw = useCallback((g: any) => {
    g.clear();

    // Document shadow
    g.beginFill(0x000000, 0.2);
    g.drawRect(-DOCUMENT_SIZE / 2 + 2, -DOCUMENT_SIZE * 0.7 + 2, DOCUMENT_SIZE, DOCUMENT_SIZE * 1.4);
    g.endFill();

    // Document paper
    g.beginFill(0xffffff);
    g.drawRect(-DOCUMENT_SIZE / 2, -DOCUMENT_SIZE * 0.7, DOCUMENT_SIZE, DOCUMENT_SIZE * 1.4);
    g.endFill();

    // Tool icon in center (main visual)
    drawToolIcon(g, stamp.kind, stamp.color, 0, -3);

    // Fold corner
    g.beginFill(0xe0e0e0);
    g.moveTo(DOCUMENT_SIZE / 2 - 4, -DOCUMENT_SIZE * 0.7);
    g.lineTo(DOCUMENT_SIZE / 2, -DOCUMENT_SIZE * 0.7 + 4);
    g.lineTo(DOCUMENT_SIZE / 2, -DOCUMENT_SIZE * 0.7);
    g.closePath();
    g.endFill();
  }, [stamp.kind, stamp.color]);

  return (
    <Container x={x + stackOffsetX} y={y + stackOffsetY} rotation={rotation} scale={scale * stackScale} alpha={stackAlpha}>
      <Graphics draw={draw} />
      <Text
        text={stamp.label}
        style={STAMP_TEXT_STYLE}
        anchor={0.5}
        x={0}
        y={DOCUMENT_SIZE * 0.45}
      />
    </Container>
  );
}

