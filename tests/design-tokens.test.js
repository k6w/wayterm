// @vitest-environment node
// Lives outside src/ so it can read files with node:fs (the app tsconfig has
// no Node types).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CHROME_KEYS } from "../src/types/theme";
import { chromeCssVar } from "../src/lib/theme-schema";

const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

describe("design tokens (src/styles.css)", () => {
  it("exposes every chrome token to Tailwind", () => {
    for (const key of CHROME_KEYS) {
      expect(css, `missing Tailwind color for chrome.${key}`).toContain(`var(${chromeCssVar(key)})`);
    }
  });

  it("uses the 11 / 12 / 13 / 15 / 20 type scale", () => {
    expect(css).toMatch(/--text-caption:\s*11px/);
    expect(css).toMatch(/--text-label:\s*12px/);
    expect(css).toMatch(/--text-body:\s*13px/);
    expect(css).toMatch(/--text-title:\s*15px/);
    expect(css).toMatch(/--text-heading:\s*20px/);
  });

  it("uses 4 / 6 / 8 radii", () => {
    expect(css).toMatch(/--radius-sm:\s*4px/);
    expect(css).toMatch(/--radius-md:\s*6px/);
    expect(css).toMatch(/--radius-lg:\s*8px/);
  });

  it("defaults to compact 28px controls with a comfortable option", () => {
    expect(css).toMatch(/--nx-control-h:\s*28px/);
    expect(css).toMatch(/\[data-density="comfortable"\]\s*\{[^}]*--nx-control-h:\s*32px/);
  });

  it("disables motion under prefers-reduced-motion", () => {
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("keeps the legacy aliases for un-migrated screens", () => {
    expect(css).toContain("--color-bg-primary: var(--nx-canvas)");
    expect(css).toContain("--color-text-primary: var(--nx-text)");
  });

  it("stacks dropdowns above dialogs and below toasts", () => {
    const z = (name) => Number(css.match(new RegExp(`--z-${name}:\\s*(\\d+)`))?.[1]);
    expect(z("dropdown")).toBeGreaterThan(z("modal"));
    expect(z("dropdown")).toBeLessThan(z("toast"));
    expect(z("toast")).toBeLessThan(z("tooltip"));
  });
});
