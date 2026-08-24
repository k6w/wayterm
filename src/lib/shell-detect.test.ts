import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { getDefaultShell, getDefaultShells, getPreferredShell, loadShellInfo, resetShellInfo } from "./shell-detect";

beforeEach(() => {
  resetShellInfo();
  vi.mocked(invoke).mockReset();
});

describe("shell detection", () => {
  it("falls back to bash/sh before the backend answers", () => {
    expect(getDefaultShell().path).toBe("/bin/bash");
  });

  it("lists the backend shells, with zsh, and uses the login shell as default", async () => {
    vi.mocked(invoke).mockResolvedValueOnce({
      loginShell: "/bin/zsh",
      shells: ["/bin/bash", "/bin/zsh", "/bin/sh"],
    });
    await loadShellInfo();
    expect(getDefaultShells().map((s) => s.path)).toEqual(["/bin/zsh", "/bin/bash", "/bin/sh"]);
    expect(getDefaultShell()).toMatchObject({ path: "/bin/zsh", type: "zsh", label: "Zsh" });
  });

  it("prefers the configured shell over the login shell", async () => {
    vi.mocked(invoke).mockResolvedValueOnce({ loginShell: "/bin/zsh", shells: ["/bin/zsh", "/bin/bash"] });
    await loadShellInfo();
    expect(getPreferredShell("/bin/bash").path).toBe("/bin/bash");
    expect(getPreferredShell("").path).toBe("/bin/zsh");
    expect(getPreferredShell(undefined).path).toBe("/bin/zsh");
  });

  it("keeps the static list when the backend fails", async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error("no ipc"));
    await loadShellInfo();
    expect(getDefaultShells().map((s) => s.path)).toEqual(["/bin/bash", "/bin/sh"]);
  });
});
