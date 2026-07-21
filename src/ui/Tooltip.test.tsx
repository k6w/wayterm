import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tooltip } from "./index";

describe("Tooltip", () => {
  it("opens on keyboard focus with its content and shortcut", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="New tab" shortcut="Control+t">
        <button type="button">+</button>
      </Tooltip>
    );
    await user.tab();
    expect(screen.getByRole("button", { name: "+" })).toHaveFocus();
    const tooltip = await screen.findByRole("tooltip");
    // Kbd renders one chip per key: "Ctrl" "T"
    expect(tooltip).toHaveTextContent(/^New tab\s*Ctrl\s*T$/);
  });

  it("closes on Escape and keeps focus on the trigger", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="New tab">
        <button type="button">+</button>
      </Tooltip>
    );
    await user.tab();
    await screen.findByRole("tooltip");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "+" })).toHaveFocus();
  });

  it("renders only the child when disabled or empty", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Tooltip content="Hidden" disabled>
          <button type="button">a</button>
        </Tooltip>
        <Tooltip content={null}>
          <button type="button">b</button>
        </Tooltip>
      </>
    );
    await user.tab();
    await user.tab();
    expect(screen.getByRole("button", { name: "b" })).toHaveFocus();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
