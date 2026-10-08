import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { PanelButton, PanelContent, PanelGroup, PanelToolbar } from "./PanelChrome";

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

describe("PanelButton", () => {
  const renderButton = (width: number) =>
    render(
      <div className={`w-[${width}px]`}>
        <PanelToolbar aria-label="Actions">
          <PanelButton label="New terminal" icon={<span />} shortcut="Control+Shift+t" />
        </PanelToolbar>
      </div>
    );

  it.each([200, 260, 400])("keeps the label as accessible name at %ipx", (width) => {
    renderButton(width);
    const button = screen.getByRole("button", { name: "New terminal" });
    expect(button.querySelector("kbd")).not.toBeNull();
  });

  it("collapses by container width: chip hides below 280px, label below 230px", () => {
    renderButton(260);
    expect(screen.getByRole("toolbar", { name: "Actions" })).toHaveClass("@container");
    const button = screen.getByRole("button", { name: "New terminal" });
    expect(button.querySelector("kbd")).toHaveClass("@max-[280px]:hidden");
    expect(screen.getByText("New terminal")).toHaveClass("@max-[230px]:sr-only");
    expect(button).toHaveClass("@max-[230px]:px-0");
  });
});
