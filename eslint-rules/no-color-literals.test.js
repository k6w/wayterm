// @vitest-environment node
import { RuleTester } from "eslint";
import tseslint from "typescript-eslint";
import { describe, it } from "vitest";
import rule from "./no-color-literals.js";

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

tester.run("no-color-literals", rule, {
  valid: [
    "const cls = 'bg-panel text-fg';",
    "const label = 'Pane #12';",
    "const id = 'tab-#a';",
    "const re = /#[0-9a-f]{6}/;",
    "const v = `var(--wt-accent)`;",
    "const s = 'rgbaish';",
  ],
  invalid: [
    { code: "const c = '#fff';", errors: [{ messageId: "noColorLiteral" }] },
    { code: "const c = '#1a1b1e';", errors: [{ messageId: "noColorLiteral" }] },
    { code: "const c = '#1a1b1e80';", errors: [{ messageId: "noColorLiteral" }] },
    { code: "const c = 'rgba(0, 0, 0, 0.5)';", errors: [{ messageId: "noColorLiteral" }] },
    { code: "const c = `rgb(${r}, ${g}, ${b})`;", errors: [{ messageId: "noColorLiteral" }] },
    { code: "const c = 'hsl(210 40% 50%)';", errors: [{ messageId: "noColorLiteral" }] },
    {
      code: "const el = <div className='bg-[#ff0000]' />;",
      errors: [{ messageId: "noColorLiteral" }],
    },
  ],
});
