#!/usr/bin/env node
// Builds the Tauri updater manifest (latest.json) once, after every platform's
// build has uploaded its bundles and signatures to the draft release.
//
// Letting each matrix job update latest.json itself races: the jobs fetch,
// edit and re-upload the same asset concurrently, and the last writer wins
// (v0.9.0 shipped without its macOS entries that way).
//
// CLI: node scripts/release/manifest.mjs <tag> <dir-with-.sig-files> <out.json>
//      node scripts/release/manifest.mjs --notes <version>   (prints the CHANGELOG section)

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Updater keys, each mapped to the bundle the updater should download for it. */
const PLATFORMS = [
  { keys: ["darwin-aarch64", "darwin-aarch64-app"], match: /_aarch64\.app\.tar\.gz$/ },
  { keys: ["darwin-x86_64", "darwin-x86_64-app"], match: /_x64\.app\.tar\.gz$/ },
  { keys: ["linux-x86_64", "linux-x86_64-appimage"], match: /\.AppImage$/ },
  { keys: ["linux-x86_64-deb"], match: /\.deb$/ },
  { keys: ["linux-x86_64-rpm"], match: /\.rpm$/ },
  { keys: ["windows-x86_64", "windows-x86_64-msi"], match: /\.msi$/ },
  { keys: ["windows-x86_64-nsis"], match: /-setup\.exe$/ },
];

/**
 * @param {object} o
 * @param {string[]} o.assets release asset names
 * @param {(sigName: string) => string} o.signature reads a .sig asset's contents
 */
export function buildManifest({ assets, signature, version, notes, pubDate, baseUrl }) {
  const names = new Set(assets);
  const platforms = {};
  const missing = [];
  for (const { keys, match } of PLATFORMS) {
    const bundle = assets.find((name) => match.test(name) && names.has(`${name}.sig`));
    if (!bundle) {
      missing.push(...keys);
      continue;
    }
    const entry = { url: baseUrl + bundle, signature: signature(`${bundle}.sig`) };
    for (const key of keys) platforms[key] = entry;
  }
  if (missing.length > 0) {
    throw new Error(`No signed bundle for: ${missing.join(", ")}`);
  }
  return { version, notes, pub_date: pubDate, platforms };
}

/** Body of the `## <version>` section of CHANGELOG.md, or null. */
export function changelogSection(changelog, version) {
  const lines = changelog.split("\n");
  const start = lines.findIndex((line) => line.startsWith(`## ${version}`));
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith("## "));
  return (end === -1 ? rest : rest.slice(0, end)).join("\n").trim();
}

function main(argv) {
  if (argv[0] === "--notes") {
    const section = changelogSection(readFileSync("CHANGELOG.md", "utf8"), argv[1]);
    process.stdout.write(section ?? `Nexterm ${argv[1]}`);
    return;
  }
  const [tag, dir, out] = argv;
  const version = tag.replace(/^v/, "");
  const repo = process.env.GITHUB_REPOSITORY;
  const assets = readdirSync(dir);
  const manifest = buildManifest({
    assets: assets.flatMap((name) => (name.endsWith(".sig") ? [name, name.slice(0, -4)] : [])),
    signature: (sigName) => readFileSync(join(dir, sigName), "utf8").trim(),
    version,
    notes: changelogSection(readFileSync("CHANGELOG.md", "utf8"), version) ?? "",
    pubDate: new Date().toISOString(),
    baseUrl: `https://github.com/${repo}/releases/download/${tag}/`,
  });
  writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`latest.json: ${Object.keys(manifest.platforms).length} platforms for ${tag}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv.slice(2));
