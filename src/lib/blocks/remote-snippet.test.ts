/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { Terminal } from "@xterm/xterm";
import { BlockTracker } from "./block-tracker";
import { remoteSnippet } from "./remote-snippet";

// Recorded with the snippets below in plain bash and zsh (no Wayterm integration), via `script -q`.
const fixtures = import.meta.glob<string>("./__fixtures__/remote-*.txt", { query: "?raw", import: "default", eager: true });

describe("remote snippets", () => {
  it("are guarded to Wayterm and explain the ssh environment caveat", () => {
    for (const shell of ["bash", "zsh", "fish"] as const) {
      const snippet = remoteSnippet(shell);
      expect(snippet).toContain('"$TERM_PROGRAM"');
      expect(snippet).toContain("SendEnv TERM_PROGRAM");
      expect(snippet).toContain("133;A");
      expect(snippet).toContain("133;C");
      expect(snippet).toContain("133;D");
      expect(snippet).toContain("]7;file://");
      expect(snippet).toContain("]0;%s");
    }
  });

  for (const shell of ["bash", "zsh"]) {
    it(`produce blocks in an SSH pane (${shell}), none of them trusted`, async () => {
      const term = new Terminal({ cols: 80, rows: 24, allowProposedApi: true });
      const tracker = new BlockTracker(term, null);
      await new Promise<void>((resolve) => term.write(fixtures[`./__fixtures__/remote-${shell}.txt`], resolve));
      expect(tracker.blocks.map((b) => [tracker.getCommandText(b), tracker.getOutputText(b), b.exitCode])).toEqual([
        ["echo hello", "hello", 0],
        ["false", "", 1],
        ["cd 'my dir'", "", 0],
        ["exit", expect.any(String), undefined],
      ]);
      expect(tracker.blocks.some((b) => b.trusted)).toBe(false);
      expect(tracker.cwd).toBe("/home/user/my dir");
    });
  }

  it("are ignored inside a local integrated shell (the marks carry no nonce)", async () => {
    const term = new Terminal({ cols: 80, rows: 24, allowProposedApi: true });
    const tracker = new BlockTracker(term, "local-nonce");
    await new Promise<void>((resolve) => term.write(fixtures["./__fixtures__/remote-bash.txt"], resolve));
    expect(tracker.blocks).toEqual([]);
  });
});
