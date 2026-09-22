import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { sshListConnections, sshSaveConnection, terminalSpawn } from "./ipc";

beforeEach(() => {
  vi.mocked(invoke).mockReset();
  vi.mocked(invoke).mockResolvedValue(null);
});

describe("ssh connection envVars wire format", () => {
  it("sends envVars as a JSON string, which is what the Rust profile stores", async () => {
    await sshSaveConnection({ id: "c1", name: "dev", envVars: { LANG: "C", A: "b" } });
    const [command, args] = vi.mocked(invoke).mock.calls[0] as [string, { profile: { envVars: unknown } }];
    expect(command).toBe("ssh_save_connection");
    expect(typeof args.profile.envVars).toBe("string");
    expect(JSON.parse(args.profile.envVars as string)).toEqual({ LANG: "C", A: "b" });
  });

  it("sends '{}' when there are no variables", async () => {
    await sshSaveConnection({ id: "c1", name: "dev" });
    const [, args] = vi.mocked(invoke).mock.calls[0] as [string, { profile: { envVars: unknown } }];
    expect(args.profile.envVars).toBe("{}");
  });

  it("parses the stored string back into an object when listing", async () => {
    vi.mocked(invoke).mockResolvedValueOnce([
      { id: "a", envVars: '{"LANG":"C"}' },
      { id: "b", envVars: "not json" },
      { id: "c", envVars: "{}" },
    ]);
    const list = (await sshListConnections()) as { id: string; envVars: unknown }[];
    expect(list.map((c) => c.envVars)).toEqual([{ LANG: "C" }, {}, {}]);
  });
});

describe("terminalSpawn wire format", () => {
  it("passes shellSetup through and defaults it to none", async () => {
    vi.mocked(invoke).mockResolvedValue("sid");
    const base = { shell: "/bin/zsh", args: [], cwd: "", env: [] as [string, string][], rows: 24, cols: 80 };
    await terminalSpawn({ ...base, shellSetup: "titleOnly" });
    await terminalSpawn(base);
    const calls = vi.mocked(invoke).mock.calls as [string, { request: { shellSetup: string } }][];
    expect(calls[0][0]).toBe("terminal_spawn");
    expect(calls[0][1].request.shellSetup).toBe("titleOnly");
    expect(calls[1][1].request.shellSetup).toBe("none");
  });

  it("returns the session id and the integration nonce", async () => {
    vi.mocked(invoke).mockResolvedValue({ sessionId: "sid", nonce: "n1" });
    const base = { shell: "/bin/zsh", args: [], cwd: "", env: [] as [string, string][], rows: 24, cols: 80 };
    await expect(terminalSpawn(base)).resolves.toEqual({ sessionId: "sid", nonce: "n1" });
    vi.mocked(invoke).mockResolvedValue({ sessionId: "sid2", nonce: null });
    await expect(terminalSpawn(base)).resolves.toEqual({ sessionId: "sid2", nonce: null });
  });
});
