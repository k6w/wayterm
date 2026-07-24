// Lint ratchet for the redesign.
//
// All lint rules are errors everywhere. Violations that existed when ESLint was
// introduced are recorded in eslint-suppressions.json (ESLint bulk
// suppressions). ESLint itself fails when a file gains new violations, and
// fails when a suppression is no longer needed until you run
// `npx eslint . --prune-suppressions`, so the file can only shrink.
//
// This script adds one more guarantee: files that have been migrated to the
// design-token kit (STRICT_PATHS) must carry no suppressions at all. Each phase
// appends the files it migrates. Never remove an entry.
import { existsSync, readFileSync } from "node:fs";

const STRICT_PATHS = [
  "src/ui/",
  "src/app/providers.tsx",
  "src/components/titlebar/Tab.tsx",
  "src/components/titlebar/Titlebar.tsx",
  "src/components/titlebar/TabRail.tsx",
  "src/components/titlebar/WindowControls.tsx",
  "src/components/titlebar/TabContextMenu.tsx",
  "src/components/titlebar/TabStrip.tsx",
  "src/components/terminal/StatusBar.tsx",
  "src/themes/",
  "src/lib/appearance.ts",
  "src/lib/color.ts",
  "src/lib/contrast.ts",
  "src/lib/fonts.ts",
  "src/lib/shortcut-hints.ts",
  "src/lib/theme-migration.ts",
  "src/lib/theme-schema.ts",
  "src/lib/theme-selection.ts",
  "src/stores/theme.ts",
  "src/stores/sidebar.ts",
  "src/lib/window-title.ts",
];

const file = "eslint-suppressions.json";
const suppressions = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
const offenders = Object.keys(suppressions).filter((path) =>
  STRICT_PATHS.some((strict) => (strict.endsWith("/") ? path.startsWith(strict) : path === strict))
);

if (offenders.length > 0) {
  console.error(
    "Lint ratchet: these migrated files still carry bulk suppressions. Fix the violations, then run `npx eslint . --prune-suppressions`:"
  );
  for (const path of offenders) console.error(`  ${path}`);
  process.exit(1);
}

console.log(
  `Lint ratchet OK (${Object.keys(suppressions).length} legacy files still carry suppressions).`
);
