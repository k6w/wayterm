// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildManifest, changelogSection } from "../scripts/release/manifest.mjs";

const ASSETS = [
  "Nexterm_aarch64.app.tar.gz",
  "Nexterm_aarch64.app.tar.gz.sig",
  "Nexterm_x64.app.tar.gz",
  "Nexterm_x64.app.tar.gz.sig",
  "Nexterm_0.9.0_aarch64.dmg",
  "Nexterm_0.9.0_amd64.AppImage",
  "Nexterm_0.9.0_amd64.AppImage.sig",
  "Nexterm_0.9.0_amd64.deb",
  "Nexterm_0.9.0_amd64.deb.sig",
  "Nexterm-0.9.0-1.x86_64.rpm",
  "Nexterm-0.9.0-1.x86_64.rpm.sig",
  "Nexterm_0.9.0_x64-setup.exe",
  "Nexterm_0.9.0_x64-setup.exe.sig",
  "Nexterm_0.9.0_x64_en-US.msi",
  "Nexterm_0.9.0_x64_en-US.msi.sig",
];
const sigOf = (name) => `sig-of:${name}`;
const BASE = "https://github.com/k6w/nexterm-terminal-app/releases/download/v0.9.0/";

describe("buildManifest", () => {
  const manifest = buildManifest({
    assets: ASSETS,
    signature: sigOf,
    version: "0.9.0",
    notes: "notes",
    pubDate: "2026-10-09T18:00:00.000Z",
    baseUrl: BASE,
  });

  it("lists every platform the updater looks up, matching what tauri-action produced", () => {
    expect(Object.keys(manifest.platforms).sort()).toEqual([
      "darwin-aarch64",
      "darwin-aarch64-app",
      "darwin-x86_64",
      "darwin-x86_64-app",
      "linux-x86_64",
      "linux-x86_64-appimage",
      "linux-x86_64-deb",
      "linux-x86_64-rpm",
      "windows-x86_64",
      "windows-x86_64-msi",
      "windows-x86_64-nsis",
    ]);
  });

  it("points each platform at the right file and its signature", () => {
    expect(manifest.platforms["darwin-aarch64"]).toEqual({
      url: `${BASE}Nexterm_aarch64.app.tar.gz`,
      signature: "sig-of:Nexterm_aarch64.app.tar.gz.sig",
    });
    expect(manifest.platforms["darwin-x86_64"].url).toBe(`${BASE}Nexterm_x64.app.tar.gz`);
    expect(manifest.platforms["linux-x86_64"].url).toBe(`${BASE}Nexterm_0.9.0_amd64.AppImage`);
    expect(manifest.platforms["windows-x86_64"].url).toBe(`${BASE}Nexterm_0.9.0_x64_en-US.msi`);
    expect(manifest.platforms["windows-x86_64-nsis"].url).toBe(`${BASE}Nexterm_0.9.0_x64-setup.exe`);
    expect(manifest).toMatchObject({ version: "0.9.0", notes: "notes", pub_date: "2026-10-09T18:00:00.000Z" });
  });

  it("refuses to publish a manifest with a platform missing", () => {
    const withoutIntelMac = ASSETS.filter((a) => !a.startsWith("Nexterm_x64.app"));
    expect(() =>
      buildManifest({ assets: withoutIntelMac, signature: sigOf, version: "0.9.0", notes: "", pubDate: "", baseUrl: BASE })
    ).toThrow(/darwin-x86_64/);
  });

  it("ignores bundles that have no signature", () => {
    const unsigned = ASSETS.filter((a) => a !== "Nexterm_0.9.0_amd64.deb.sig");
    expect(() =>
      buildManifest({ assets: unsigned, signature: sigOf, version: "0.9.0", notes: "", pubDate: "", baseUrl: BASE })
    ).toThrow(/linux-x86_64-deb/);
  });
});

describe("changelogSection", () => {
  const changelog = "# Changelog\n\n## 0.9.0 - 2026-10-09\n\nIntro.\n\n### Area\n- item\n\n## 0.8.0 and earlier\n\nOld.\n";

  it("returns the body of the matching version section", () => {
    expect(changelogSection(changelog, "0.9.0")).toBe("Intro.\n\n### Area\n- item");
  });

  it("returns null when the version has no section", () => {
    expect(changelogSection(changelog, "1.0.0")).toBeNull();
  });
});
