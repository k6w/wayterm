// @vitest-environment node
import { RuleTester } from "eslint";
import tseslint from "typescript-eslint";
import { describe, it } from "vitest";
import rule from "./no-inline-style.js";

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

tester.run("no-inline-style", rule, {
  valid: [
    "<div className='bg-panel' />",
    "<div style={{ width: size, height: 20 }} />",
    "<div style={{ flexBasis: `${ratio * 100}%`, flexGrow: 0, flexShrink: 0 }} />",
    "<div style={{ top: y, left: x, transform: t }} />",
    "<span style={{ '--nx-dyn-tag': color } as React.CSSProperties} />",
    "<div style={{}} />",
  ],
  invalid: [
    { code: "<div style={{ color: 'red' }} />", errors: [{ messageId: "disallowedKey" }] },
    {
      code: "<div style={{ width: 10, backgroundColor: c }} />",
      errors: [{ messageId: "disallowedKey" }],
    },
    { code: "<div style={styles} />", errors: [{ messageId: "notObject" }] },
    { code: "<div style={{ ...base }} />", errors: [{ messageId: "notObject" }] },
    { code: "<div style={{ ['width']: 1 }} />", errors: [{ messageId: "disallowedKey" }] },
    { code: "<div style={{ '--accent': c }} />", errors: [{ messageId: "disallowedKey" }] },
    { code: "<motion.div style={{ opacity: 1 }} />", errors: [{ messageId: "disallowedKey" }] },
  ],
});
