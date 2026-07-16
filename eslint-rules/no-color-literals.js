/**
 * nexterm/no-color-literals
 *
 * Bans hex (#rgb, #rgba, #rrggbb, #rrggbbaa), rgb()/rgba() and hsl()/hsla()
 * color literals in string literals and template literals. Colors live in
 * src/themes/ and reach components through design tokens.
 */
const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9a-zA-Z_-])/;
const COLOR_FUNCTION = /\b(?:rgba?|hsla?)\s*\(/i;

export function containsColorLiteral(text) {
  return HEX.test(text) || COLOR_FUNCTION.test(text);
}

export default {
  meta: {
    type: "problem",
    docs: { description: "Disallow hex, rgb() and hsl() color literals outside src/themes/" },
    schema: [],
    messages: {
      noColorLiteral:
        "Color literal '{{text}}' is not allowed here. Add a token to the theme schema (src/themes/) and use its Tailwind class.",
    },
  },
  create(context) {
    function check(node, text) {
      if (typeof text === "string" && containsColorLiteral(text)) {
        context.report({ node, messageId: "noColorLiteral", data: { text: text.slice(0, 40) } });
      }
    }
    return {
      Literal(node) {
        if (typeof node.value === "string") check(node, node.value);
      },
      TemplateElement(node) {
        check(node, node.value.cooked ?? node.value.raw);
      },
    };
  },
};
