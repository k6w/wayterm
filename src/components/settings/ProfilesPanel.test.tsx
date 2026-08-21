import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProfilesPanel from "./ProfilesPanel";
import { useSettingsStore } from "../../stores/settings";
import { createProfile } from "./profile-utils";

beforeEach(() => {
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
});

const profiles = () => useSettingsStore.getState().settings.profiles;

function withProfile(changes = {}) {
  useSettingsStore.setState((s) => ({
    settings: { ...s.settings, profiles: [{ ...createProfile("p1"), name: "Work", ...changes }] },
  }));
}

describe("ProfilesPanel", () => {
  it("lists the detected shells", () => {
    render(<ProfilesPanel />);
    const shells = screen.getByRole("region", { name: "Available shells" });
    expect(within(shells).getByText("/bin/bash")).toBeInTheDocument();
  });

  it("adds a profile and opens its editor", async () => {
    const user = userEvent.setup();
    render(<ProfilesPanel />);
    expect(screen.getByText("No custom profiles yet")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add profile" }));
    expect(profiles()).toHaveLength(1);
    expect(screen.getByRole("button", { name: /New Profile/, expanded: true })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("New Profile");
  });

  it("expands and collapses a profile from its header", async () => {
    const user = userEvent.setup();
    withProfile();
    render(<ProfilesPanel />);
    const header = screen.getByRole("button", { name: /^Work/, expanded: false });
    await user.click(header);
    expect(header).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("textbox", { name: "Name" })).toBeInTheDocument();
    await user.click(header);
    expect(screen.queryByRole("textbox", { name: "Name" })).not.toBeInTheDocument();
  });

  it("switches to a custom shell path", async () => {
    const user = userEvent.setup();
    withProfile();
    render(<ProfilesPanel />);
    await user.click(screen.getByRole("button", { name: /^Work/ }));
    await user.click(screen.getByRole("combobox", { name: "Shell" }));
    await user.click(await screen.findByRole("option", { name: "Custom path…" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Shell path" }), { target: { value: "/opt/fish" } });
    expect(profiles()[0].shellPath).toBe("/opt/fish");
  });

  it("keeps an environment variable row in place while it is renamed", async () => {
    const user = userEvent.setup();
    withProfile({ env: { A: "1", B: "2" } });
    render(<ProfilesPanel />);
    await user.click(screen.getByRole("button", { name: /^Work/ }));
    const name = screen.getByRole("textbox", { name: "Variable 1 name" });
    await user.type(name, "X");
    expect(Object.keys(profiles()[0].env)).toEqual(["AX", "B"]);
    expect(screen.getByRole("textbox", { name: "Variable 1 name" })).toHaveFocus();
  });

  it("maps Default to no override", async () => {
    const user = userEvent.setup();
    withProfile({ cursorStyleOverride: "block" });
    render(<ProfilesPanel />);
    await user.click(screen.getByRole("button", { name: /^Work/ }));
    const cursor = screen.getByRole("combobox", { name: "Cursor style" });
    expect(cursor).toHaveTextContent("Block");
    await user.click(cursor);
    await user.click(await screen.findByRole("option", { name: "Default" }));
    expect(profiles()[0].cursorStyleOverride).toBeNull();
    expect(screen.getByRole("spinbutton", { name: "Font size" })).toHaveValue(null);
  });

  it("duplicates and deletes profiles", async () => {
    const user = userEvent.setup();
    withProfile();
    render(<ProfilesPanel />);
    await user.click(screen.getByRole("button", { name: "Duplicate Work" }));
    expect(profiles().map((p) => p.name)).toEqual(["Work", "Work (Copy)"]);
    await user.click(screen.getByRole("button", { name: "Delete Work" }));
    const dialog = await screen.findByRole("dialog", { name: "Delete profile" });
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    expect(profiles().map((p) => p.name)).toEqual(["Work (Copy)"]);
  });
});
