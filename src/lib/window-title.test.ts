import { describe, expect, it, vi } from "vitest";
import { createTitleSync, windowTitleFor } from "./window-title";
import type { TerminalTab } from "../types/terminal";

const tab = (id: string, title: string): TerminalTab => ({
  id,
  title,
  icon: "",
  shellType: "zsh",
  panes: { type: "pane", paneId: `${id}-p` },
  isActive: false,
});

describe("windowTitleFor", () => {
  it("names the active tab, or just the app", () => {
    const tabs = [tab("a", "zsh"), tab("b", "logs")];
    expect(windowTitleFor(tabs, "b")).toBe("logs — Wayterm");
    expect(windowTitleFor(tabs, null)).toBe("Wayterm");
    expect(windowTitleFor([], "gone")).toBe("Wayterm");
  });
});

describe("createTitleSync", () => {
  it("applies only changes", () => {
    const apply = vi.fn(async () => {});
    const sync = createTitleSync(apply);
    sync("zsh — Wayterm");
    sync("zsh — Wayterm");
    sync("zsh — Wayterm");
    sync("logs — Wayterm");
    expect(apply.mock.calls).toEqual([["zsh — Wayterm"], ["logs — Wayterm"]]);
  });

  it("retries a title whose apply failed", async () => {
    const apply = vi.fn().mockRejectedValueOnce(new Error("no window")).mockResolvedValue(undefined);
    const sync = createTitleSync(apply);
    sync("zsh — Wayterm");
    await Promise.resolve();
    await Promise.resolve();
    sync("zsh — Wayterm");
    expect(apply).toHaveBeenCalledTimes(2);
  });
});
