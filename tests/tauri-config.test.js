// @vitest-environment node
// Lives outside src/ so it can read files with node:fs.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const config = JSON.parse(readFileSync(new URL("../src-tauri/tauri.conf.json", import.meta.url), "utf8"));
const cargo = readFileSync(new URL("../src-tauri/Cargo.toml", import.meta.url), "utf8");

describe("tauri.conf.json", () => {
  it("names the app Wayterm", () => {
    expect(config.productName).toBe("Wayterm");
    expect(config.app.windows[0].title).toBe("Wayterm");
  });

  it("uses the Wayterm bundle identifier, which macOS rejects when it ends in .app", () => {
    expect(config.identifier).toBe("com.wayterm.terminal");
    expect(config.identifier.endsWith(".app")).toBe(false);
  });

  it("checks for updates in the wayterm repository", () => {
    expect(config.plugins.updater.endpoints).toEqual([
      "https://github.com/k6w/wayterm/releases/latest/download/latest.json",
    ]);
  });

  it("matches the Cargo package and lib names", () => {
    expect(cargo).toMatch(/^\[package\]\nname = "wayterm"$/m);
    expect(cargo).toMatch(/^name = "wayterm_lib"$/m);
  });
});
