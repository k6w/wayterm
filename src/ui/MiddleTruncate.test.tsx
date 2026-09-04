import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MiddleTruncate } from "./MiddleTruncate";

describe("MiddleTruncate", () => {
  it("keeps the full text for assistive tech and shows it in a Tooltip", async () => {
    const user = userEvent.setup();
    render(<MiddleTruncate text="redesign/phase-5-settings" />);
    expect(screen.getByText("redesign/phase-5-settings")).toBeInTheDocument();
    await user.hover(screen.getByText("redesign/phase-5-settings").parentElement as HTMLElement);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("redesign/phase-5-settings");
  });

  it("stays on one line", () => {
    const { container } = render(<MiddleTruncate text="redesign/phase-5-settings" />);
    expect(container.firstElementChild).toHaveClass("whitespace-nowrap", "min-w-0");
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
