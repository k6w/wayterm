import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MiddleTruncate } from "./MiddleTruncate";

describe("MiddleTruncate", () => {
  it("keeps the full text for assistive tech and as a native tooltip", () => {
    render(<MiddleTruncate text="redesign/phase-5-settings" />);
    expect(screen.getByText("redesign/phase-5-settings")).toBeInTheDocument();
    expect(screen.getByTitle("redesign/phase-5-settings")).toBeInTheDocument();
  });

  it("pins the tail so the end of a long name stays visible", () => {
    const { container } = render(<MiddleTruncate text="redesign/phase-5-settings" />);
    const tail = container.querySelector("[data-truncate-tail]");
    expect(tail?.textContent).toBe("5-settings");
    expect(tail).toHaveClass("shrink-0");
    expect(container.querySelector("[data-truncate-head]")).toHaveClass("truncate");
  });

  it("does not split short text", () => {
    const { container } = render(<MiddleTruncate text="main" />);
    expect(container.querySelector("[data-truncate-tail]")).toBeNull();
  });
});
