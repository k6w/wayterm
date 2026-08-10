import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { PanelContent, PanelGroup, PanelToolbar } from "./PanelChrome";

describe("panel chrome", () => {
  it("renders a labelled toolbar, a scrolling body and a titled group with a count", () => {
    render(
      <>
        <PanelToolbar aria-label="Git actions">
          <button type="button">Refresh</button>
        </PanelToolbar>
        <PanelContent data-testid="body">
          <PanelGroup title="Staged" count={2} actions={<button type="button">Unstage all</button>}>
            <p>row</p>
          </PanelGroup>
        </PanelContent>
      </>
    );
    expect(screen.getByRole("toolbar", { name: "Git actions" })).toHaveClass("h-9", "border-b");
    expect(screen.getByTestId("body")).toHaveClass("overflow-y-auto", "flex-1");
    const group = screen.getByRole("region", { name: "Staged" });
    expect(within(group).getByText("2")).toBeInTheDocument();
    expect(within(group).getByRole("button", { name: "Unstage all" })).toBeInTheDocument();
    expect(within(group).getByText("row")).toBeInTheDocument();
  });

  it("leaves the count out when none is given", () => {
    render(<PanelGroup title="Workspaces" />);
    expect(screen.getByRole("region", { name: "Workspaces" }).textContent).toBe("Workspaces");
  });
});
