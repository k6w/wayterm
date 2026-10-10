import noInlineStyle from "./no-inline-style.js";
import noColorLiterals from "./no-color-literals.js";

export default {
  meta: { name: "eslint-plugin-wayterm" },
  rules: {
    "no-inline-style": noInlineStyle,
    "no-color-literals": noColorLiterals,
  },
};
