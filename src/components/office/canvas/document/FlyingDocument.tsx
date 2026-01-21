import { Container, Graphics, Text } from "@pixi/react";
import { useCallback, useEffect, useMemo } from "react";
import { TextStyle } from "pixi.js";
import type { DocumentTransfer } from "../../../../store";
import { TOOL_COLORS } from "../../../../types";
import { DOCUMENT_ARC_HEIGHT, DOCUMENT_SIZE, DOCUMENT_TRANSFER_DURATION_MS } from "../constants";
import { clamp01, easeOutCubic, lerp } from "../math";
import { getAgentPosition } from "../layout";

type ToolKind = "explore" | "analyze" | "architect" | "develop" | "operate" | "validate" | "connect" | "liaison" | "other";

interface ToolStamp {
  label: string;
  color: number;
  kind: ToolKind;
}

const DEFAULT_STAMP: ToolStamp = { label: "???", color: TOOL_COLORS.other, kind: "other" };

/**
 * Tool stamps for flying documents (workflow-based).
 * Maps tool names to visual stamps shown during document transfer.
 */
const TOOL_STAMPS: Record<string, ToolStamp> = {
  // Explorer tools - 파일 탐색
  read: { label: "EXPL", color: TOOL_COLORS.explore, kind: "explore" },
  glob: { label: "EXPL", color: TOOL_COLORS.explore, kind: "explore" },

  // Analyzer tools - 내용 분석
  grep: { label: "ANLZ", color: TOOL_COLORS.analyze, kind: "analyze" },
  websearch: { label: "ANLZ", color: TOOL_COLORS.analyze, kind: "analyze" },

  // Architect tools - 계획 수립
  todowrite: { label: "ARCH", color: TOOL_COLORS.architect, kind: "architect" },
  task: { label: "ARCH", color: TOOL_COLORS.architect, kind: "architect" },

  // Developer tools - 코드 작성
  write: { label: "DEV", color: TOOL_COLORS.develop, kind: "develop" },
  edit: { label: "DEV", color: TOOL_COLORS.develop, kind: "develop" },
  notebookedit: { label: "DEV", color: TOOL_COLORS.develop, kind: "develop" },

  // Operator tools - 명령 실행
  bash: { label: "OPER", color: TOOL_COLORS.operate, kind: "operate" },

  // Connector tools - 외부 연동
  webfetch: { label: "CONN", color: TOOL_COLORS.connect, kind: "connect" },
  skill: { label: "CONN", color: TOOL_COLORS.connect, kind: "connect" },

  // Liaison tools - 사용자 소통
  askuserquestion: { label: "LIAS", color: TOOL_COLORS.liaison, kind: "liaison" },
};

function getToolStamp(toolName: string | null | undefined): ToolStamp {
  const tool = toolName?.trim()?.toLowerCase();
  if (!tool) return DEFAULT_STAMP;

  const stamp = TOOL_STAMPS[tool];
  if (stamp) return stamp;

  return { label: tool.slice(0, 4).toUpperCase(), color: 0x6b7280, kind: "other" };
}

// Pixel art icon rendering for each tool kind (workflow-based)
function drawToolIcon(g: any, kind: ToolKind, color: number, cx: number, cy: number): void {
  const P = 2; // pixel size
  g.beginFill(color, 0.95);

  switch (kind) {
    case "explore":
      // Compass/folder icon for exploration (8x6 pixels)
      // Folder body
      g.drawRect(cx - 4 * P, cy - P, 8 * P, 4 * P);
      g.drawRect(cx - 4 * P, cy - 2 * P, 3 * P, P);
      g.endFill();
      // Folder tab
      g.beginFill(0xffffff, 0.4);
      g.drawRect(cx - 3 * P, cy, 2 * P, P);
      g.drawRect(cx + P, cy, 2 * P, P);
      g.endFill();
      break;

    case "analyze":
      // Magnifying glass icon (7x7 pixels)
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

    case "architect":
      // Blueprint/plan icon (6x7 pixels)
      g.drawRect(cx - 2 * P, cy - 3 * P, 5 * P, 6 * P);
      g.endFill();
      // Grid lines
      g.beginFill(0xffffff, 0.6);
      g.drawRect(cx - P, cy - 2 * P, P, 4 * P);
      g.drawRect(cx + P, cy - 2 * P, P, 4 * P);
      g.drawRect(cx - P, cy - P, 3 * P, P);
      g.drawRect(cx - P, cy + P, 3 * P, P);
      g.endFill();
      break;

    case "develop":
      // Code brackets icon (7x7 pixels)
      // Left bracket <
      g.drawRect(cx - 3 * P, cy - P, P, 2 * P);
      g.drawRect(cx - 2 * P, cy - 2 * P, P, P);
      g.drawRect(cx - 2 * P, cy + P, P, P);
      // Right bracket >
      g.drawRect(cx + 2 * P, cy - P, P, 2 * P);
      g.drawRect(cx + P, cy - 2 * P, P, P);
      g.drawRect(cx + P, cy + P, P, P);
      // Slash /
      g.drawRect(cx, cy - P, P, P);
      g.drawRect(cx - P, cy, P, P);
      g.endFill();
      break;

    case "operate":
      // Terminal/lightning icon (6x8 pixels)
      g.drawRect(cx - P, cy - 3 * P, 3 * P, P);
      g.drawRect(cx - 2 * P, cy - 2 * P, 3 * P, P);
      g.drawRect(cx - P, cy - P, 3 * P, P);
      g.drawRect(cx, cy, 2 * P, P);
      g.drawRect(cx - P, cy + P, 3 * P, P);
      g.drawRect(cx, cy + 2 * P, 2 * P, P);
      g.endFill();
      break;

    case "validate":
      // Checkmark/shield icon (6x7 pixels)
      // Shield outline
      g.drawRect(cx - 2 * P, cy - 3 * P, 5 * P, P);
      g.drawRect(cx - 3 * P, cy - 2 * P, P, 3 * P);
      g.drawRect(cx + 2 * P, cy - 2 * P, P, 3 * P);
      g.drawRect(cx - 2 * P, cy + P, P, P);
      g.drawRect(cx + P, cy + P, P, P);
      g.drawRect(cx - P, cy + 2 * P, 2 * P, P);
      g.endFill();
      // Checkmark
      g.beginFill(0xffffff, 0.8);
      g.drawRect(cx - P, cy, P, P);
      g.drawRect(cx, cy - P, P, 2 * P);
      g.drawRect(cx + P, cy - 2 * P, P, P);
      g.endFill();
      break;

    case "connect":
      // Plug/link icon (7x6 pixels)
      // Left connector
      g.drawRect(cx - 3 * P, cy - P, 2 * P, 2 * P);
      g.drawRect(cx - 4 * P, cy - 2 * P, P, P);
      g.drawRect(cx - 4 * P, cy + P, P, P);
      // Right connector
      g.drawRect(cx + P, cy - P, 2 * P, 2 * P);
      g.drawRect(cx + 3 * P, cy - 2 * P, P, P);
      g.drawRect(cx + 3 * P, cy + P, P, P);
      // Connection line
      g.drawRect(cx - P, cy, 2 * P, P);
      g.endFill();
      break;

    case "liaison":
      // Speech bubble icon (7x6 pixels)
      // Bubble body
      g.drawRect(cx - 3 * P, cy - 2 * P, 6 * P, 3 * P);
      g.drawRect(cx - 2 * P, cy - 3 * P, 4 * P, P);
      // Tail
      g.drawRect(cx - 2 * P, cy + P, 2 * P, P);
      g.drawRect(cx - 3 * P, cy + 2 * P, P, P);
      g.endFill();
      // Dots
      g.beginFill(0xffffff, 0.7);
      g.drawRect(cx - 2 * P, cy - P, P, P);
      g.drawRect(cx, cy - P, P, P);
      g.drawRect(cx + 2 * P, cy - P, P, P);
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

