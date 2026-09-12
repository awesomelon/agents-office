import { describe, expect, it, vi } from "vitest";
import { ShaderSystem } from "pixi.js";
import "../../src/components/office/canvas/pixiSetup";
import { calculateOfficeViewport } from "../../src/components/office/canvas/viewport";
import {
  OFFICE_HEIGHT,
  OFFICE_WIDTH,
} from "../../src/components/office/canvas/constants";

describe("office viewport", () => {
  it.each([
    [0, 0],
    [0, 600],
    [600, 0],
    [-1, 100],
    [NaN, 100],
    [100, Infinity],
  ])(
    "keeps initial or collapsed geometry finite (%s × %s)",
    (width, height) => {
      const geometry = calculateOfficeViewport(width, height);
      expect(geometry.scale).toBeGreaterThan(0);
      expect(Object.values(geometry.viewport).every(Number.isFinite)).toBe(
        true,
      );
      expect(Number.isFinite(geometry.offsetX + geometry.offsetY)).toBe(true);
    },
  );

  it.each([
    [320, 700],
    [1200, 500],
    [550, 700],
  ])(
    "fits the entire office and round-trips stage coordinates (%s × %s)",
    (width, height) => {
      const { scale, offsetX, offsetY, viewport } = calculateOfficeViewport(
        width,
        height,
      );
      expect(OFFICE_WIDTH * scale).toBeLessThanOrEqual(width);
      expect(OFFICE_HEIGHT * scale).toBeLessThanOrEqual(height);
      expect(viewport.x * scale + offsetX).toBeCloseTo(0);
      expect(viewport.y * scale + offsetY).toBeCloseTo(0);
      expect((viewport.x + viewport.width) * scale + offsetX).toBeCloseTo(
        width,
      );
      expect((viewport.y + viewport.height) * scale + offsetY).toBeCloseTo(
        height,
      );
    },
  );
});

it("initializes Pixi shaders and uploads a uniform when dynamic code is forbidden", () => {
  const uniform1f = vi.fn();
  const renderer = { gl: { uniform1f } };
  const blockedFunction = vi.fn(function () {
    throw new Error("CSP forbids unsafe-eval");
  });
  vi.stubGlobal("Function", blockedFunction);
  try {
    const shader = new ShaderSystem(renderer as never);
    shader.shader = {
      program: {
        uniformData: { alpha: { type: "float", size: 1, isArray: false } },
      },
    } as never;
    shader.syncUniforms(
      { uniforms: { alpha: 0.75 } } as never,
      {
        uniformData: { alpha: { location: "alpha-location", value: 0 } },
      } as never,
      { textureCount: 0, uboCount: 0 },
    );
    expect(uniform1f).toHaveBeenCalledWith("alpha-location", 0.75);
    expect(blockedFunction).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
  }
});
