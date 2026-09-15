import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PaneNotice from "./PaneNotice";
import { useTerminalStore } from "../../stores/terminal";

function seed(notice?: string) {
  useTerminalStore.setState({ panes: { p1: { id: "p1", sessionId: "", isActive: true, cwd: "", shellType: "zsh", notice } } });
}

beforeEach(() => seed("/old no longer exists. Started in your home folder."));

describe("PaneNotice", () => {
  it("shows the pane's notice as a status message", () => {
    render(<PaneNotice paneId="p1" />);
    expect(screen.getByRole("status")).toHaveTextContent("/old no longer exists. Started in your home folder.");
  });

  it("renders nothing without a notice", () => {
    seed(undefined);
    const { container } = render(<PaneNotice paneId="p1" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("clears the notice when dismissed", async () => {
    render(<PaneNotice paneId="p1" />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Dismiss notice" }));
    expect(useTerminalStore.getState().panes.p1.notice).toBeUndefined();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
