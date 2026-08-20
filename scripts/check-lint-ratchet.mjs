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
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

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
  "src/components/terminal/SplitContainer.tsx",
  "src/components/terminal/PaneFrame.tsx",
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
  "src/components/sidebar/ActivityBar.tsx",
  "src/components/sidebar/Sidebar.tsx",
  "src/components/sidebar/sections.ts",
  "src/lib/keybindings.ts",
  "src/app/App.tsx",
  "src/app/NoTabsState.tsx",
  "src/components/command-palette/",
  "src/components/ssh/ConnectionDialog.tsx",
  "src/components/ssh/connection-form.ts",
  "src/components/ssh/HostKeyDialog.tsx",
  "src/components/ssh/host-key.ts",
  "src/components/serial/",
  "src/components/ui/ConfirmDialog.tsx",
  "src/components/ui/InputDialog.tsx",
  "src/components/search/",
  "src/lib/download-file.ts",
  "src/components/sidebar/PanelChrome.tsx",
  "src/components/sidebar/connection-tree.ts",
  "src/components/sidebar/ConnectionTree.tsx",
  "src/components/sidebar/WorkspaceList.tsx",
  "src/components/sidebar/QuickActions.tsx",
  "src/components/sidebar/TunnelsPanel.tsx",
  "src/components/ssh/port-forward-form.ts",
  "src/components/ssh/QuickPortForwardDialog.tsx",
  "src/components/clipboard/",
  "src/components/settings/snippets.ts",
  "src/components/settings/SnippetDialog.tsx",
  "src/components/settings/SnippetsPanel.tsx",
  "src/components/git/git-changes.ts",
  "src/components/git/GitPanel.tsx",
  "src/components/git/GitChanges.tsx",
  "src/components/git/GitHistory.tsx",
  "src/components/git/DiffViewer.tsx",
  "src/components/database/",
  "src/components/sftp/sftp-paths.ts",
  "src/components/sftp/file-table.ts",
  "src/components/sftp/FileTable.tsx",
  "src/components/sftp/PathBreadcrumb.tsx",
  "src/components/sftp/TransferQueue.tsx",
  "src/components/sftp/FileConflictDialog.tsx",
  "src/components/sftp/",
  "src/components/settings/SettingRow.tsx",
  "src/components/settings/SettingsView.tsx",
  "src/components/settings/nav.tsx",
  "src/components/settings/searchIndex.ts",
];

const file = "eslint-suppressions.json";
const suppressions = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
const offenders = Object.keys(suppressions).filter((path) =>
  STRICT_PATHS.some((strict) => (strict.endsWith("/") ? path.startsWith(strict) : path === strict))
);

// Inline `eslint-disable` comments are suppressions too, and ESLint does not
// count them in eslint-suppressions.json. Migrated files may not carry any.
function strictFiles() {
  const files = [];
  for (const strict of STRICT_PATHS) {
    if (!existsSync(strict)) continue;
    if (!statSync(strict).isDirectory()) {
      files.push(strict);
      continue;
    }
    for (const entry of readdirSync(strict, { recursive: true })) {
      const path = join(strict, String(entry)).split("\\").join("/");
      if (/\.(ts|tsx|js|mjs)$/.test(path) && statSync(path).isFile()) files.push(path);
    }
  }
  return files;
}

const disabled = strictFiles().filter((path) => /eslint-disable/.test(readFileSync(path, "utf8")));
if (disabled.length > 0) {
  console.error("Lint ratchet: these migrated files contain eslint-disable comments. Fix the code instead:");
  for (const path of disabled) console.error(`  ${path}`);
  process.exit(1);
}

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
