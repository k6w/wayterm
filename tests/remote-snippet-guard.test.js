// @vitest-environment node
// Runs each remote snippet in a real interactive shell (when it is installed) to
// check the TERM_PROGRAM guard. Lives outside src/ for node:child_process.
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { remoteSnippet } from "../src/lib/blocks/remote-snippet.ts";

const SHELLS = {
  bash: {
    args: (code) => ["--norc", "--noprofile", "-i", "-c", code],
    probe: "declare -F _wt_precmd >/dev/null && echo HOOKED || echo SKIPPED",
  },
  zsh: {
    args: (code) => ["-f", "-i", "-c", code],
    probe: "(( $+functions[_wt_precmd] )) && echo HOOKED || echo SKIPPED",
  },
  fish: {
    args: (code) => ["--no-config", "-i", "-c", code],
    probe: "functions -q _wt_prompt; and echo HOOKED; or echo SKIPPED",
  },
};

function installed(shell) {
  return spawnSync(shell, ["-c", "exit 0"], { stdio: "ignore" }).status === 0;
}

function run(shell, termProgram) {
  const { args, probe } = SHELLS[shell];
  const env = { ...process.env, TERM_PROGRAM: termProgram, HOME: process.env.HOME ?? "/tmp" };
  const result = spawnSync(shell, args(`${remoteSnippet(shell)}\n${probe}`), {
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 10_000,
  });
  return result.stdout.trim().split("\n").pop();
}

describe("remote snippet guard", () => {
  for (const shell of Object.keys(SHELLS)) {
    it.skipIf(!installed(shell))(`hooks ${shell} only when TERM_PROGRAM is wayterm`, () => {
      expect(run(shell, "wayterm")).toBe("HOOKED");
      expect(run(shell, "iTerm.app")).toBe("SKIPPED");
      expect(run(shell, "")).toBe("SKIPPED");
    });
  }

  it("checks for wayterm in every snippet", () => {
    for (const shell of Object.keys(SHELLS)) {
      expect(remoteSnippet(shell)).toMatch(/"\$TERM_PROGRAM" (==|=) wayterm/);
      expect(remoteSnippet(shell)).toContain("# Wayterm command blocks");
    }
  });
});
