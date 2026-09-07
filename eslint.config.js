import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import nexterm from "./eslint-rules/index.js";

/**
 * Lint ratchet (see docs in scripts/check-lint-ratchet.mjs):
 * every rule is an error everywhere; pre-existing violations are recorded in
 * eslint-suppressions.json (ESLint bulk suppressions) and may only shrink.
 */
export default [
  {
    ignores: ["dist/**", "node_modules/**", "src-tauri/**", "docs/**", "public/**", "coverage/**"],
  },
  {
    // Existing eslint-disable comments predate this config; do not fail on them.
    linterOptions: { reportUnusedDisableDirectives: "off" },
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks, nexterm },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
      "nexterm/no-inline-style": "error",
      "nexterm/no-color-literals": "error",
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "lucide-react",
              message: "Import icons through the semantic registry in src/ui/icons.tsx (Icon / Icons).",
            },
          ],
        },
      ],
    },
  },
  {
    // The one place the icon library may be imported.
    files: ["src/ui/icons.tsx"],
    rules: { "no-restricted-imports": "off" },
  },
  {
    // Theme data, color math, foreign-theme converters and test fixtures are
    // where literal colors legitimately live.
    files: [
      "src/themes/**",
      "src/lib/color.ts",
      "src/lib/theme-import.ts",
      "src/**/*.test.{ts,tsx}",
      "src/test/**",
    ],
    rules: { "nexterm/no-color-literals": "off" },
  },
];
