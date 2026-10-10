import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import wayterm from "./eslint-rules/index.js";

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
    // No eslint-disable comments remain; any stale one is an error.
    linterOptions: { reportUnusedDisableDirectives: "error" },
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
    plugins: { "react-hooks": reactHooks, wayterm },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
      "wayterm/no-inline-style": "error",
      "wayterm/no-color-literals": "error",
      "no-restricted-syntax": [
        "error",
        {
          // A local named Icon shadows the registry's <Icon> component, so a later
          // <Icon name=... /> in the same scope silently renders the wrong glyph.
          selector: "VariableDeclarator[id.name='Icon'], FunctionDeclaration[id.name='Icon']",
          message: "Don't declare a local named Icon; it shadows the registry <Icon>. Use a descriptive name (e.g. ItemIcon).",
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@phosphor-icons/react",
              message: "Import icons through the semantic registry in src/ui/icons.tsx (Icon / Icons).",
            },
          ],
        },
      ],
    },
  },
  {
    // The one place the icon library may be imported and <Icon> is defined.
    files: ["src/ui/icons.tsx"],
    rules: { "no-restricted-imports": "off", "no-restricted-syntax": "off" },
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
    rules: { "wayterm/no-color-literals": "off" },
  },
];
