import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import UpdateNotification, { UPDATE_CHECK_DELAY_MS } from "./UpdateNotification";
import { useSettingsStore } from "../stores/settings";

vi.mock("@tauri-apps/plugin-updater", () => ({ check: vi.fn(async () => null) }));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: vi.fn(async () => {}) }));

function fakeUpdate(downloadAndInstall = vi.fn(async () => {})) {
  return { available: true, version: "0.9.0", downloadAndInstall } as unknown as Update;
}

async function runCheck() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(UPDATE_CHECK_DELAY_MS);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
});

afterEach(() => {
  vi.useRealTimers();
  vi.mocked(check).mockReset().mockResolvedValue(null);
});

describe("UpdateNotification", () => {
  it("shows nothing when no update is available", async () => {
    render(<UpdateNotification />);
    await runCheck();
    expect(check).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("does not check while update checks are off", async () => {
    useSettingsStore.setState((s) => ({
      settings: { ...s.settings, general: { ...s.settings.general, checkForUpdates: false } },
    }));
    render(<UpdateNotification />);
    await runCheck();
    expect(check).not.toHaveBeenCalled();
  });

  it("announces a new version and can be dismissed", async () => {
    vi.mocked(check).mockResolvedValue(fakeUpdate());
    render(<UpdateNotification />);
    await runCheck();
    expect(screen.getByRole("status")).toHaveTextContent("nexterm v0.9.0 is available");
    act(() => screen.getByRole("button", { name: "Dismiss update" }).click());
    expect(screen.queryByText(/is available/)).not.toBeInTheDocument();
  });

  it("installs and relaunches", async () => {
    const install = vi.fn(async () => {});
    vi.mocked(check).mockResolvedValue(fakeUpdate(install));
    render(<UpdateNotification />);
    await runCheck();
    await act(async () => {
      screen.getByRole("button", { name: "Update and restart" }).click();
    });
    expect(install).toHaveBeenCalledTimes(1);
    expect(relaunch).toHaveBeenCalledTimes(1);
  });
});
