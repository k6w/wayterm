import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";

describe("test environment", () => {
  it("renders React into jsdom with jest-dom matchers", () => {
    render(<button type="button">Hello</button>);
    expect(screen.getByRole("button", { name: "Hello" })).toBeInTheDocument();
  });

  it("mocks the Tauri IPC bridge", async () => {
    await expect(invoke("anything")).resolves.toBeNull();
  });

  it("provides the browser APIs Radix needs", () => {
    expect(typeof ResizeObserver).toBe("function");
    expect(typeof Element.prototype.scrollIntoView).toBe("function");
    expect(typeof Element.prototype.hasPointerCapture).toBe("function");
    expect(typeof window.matchMedia).toBe("function");
  });
});
