/**
 * nexterm/no-inline-style
 *
 * Bans `style={...}` on JSX elements, except object literals whose keys are
 * all dynamic layout properties (pane sizes, offsets, virtualized positions)
 * or `--nx-dyn-*` custom properties carrying user data (e.g. a tab color tag).
 */
export const LAYOUT_KEYS = new Set([
  "width", "height", "minWidth", "maxWidth", "minHeight", "maxHeight",
  "top", "right", "bottom", "left", "inset",
  "transform", "translate",
  "flexBasis", "flexGrow", "flexShrink",
  "gridTemplateColumns", "gridTemplateRows", "gridColumn", "gridRow",
]);

export const DYNAMIC_PREFIX = "--nx-dyn-";

function unwrap(expression) {
  let current = expression;
  while (
    current &&
    (current.type === "TSAsExpression" ||
      current.type === "TSSatisfiesExpression" ||
      current.type === "TSNonNullExpression")
  ) {
    current = current.expression;
  }
  return current;
}

function keyName(property) {
  if (property.computed) return null;
  if (property.key.type === "Identifier") return property.key.name;
  if (property.key.type === "Literal" && typeof property.key.value === "string") {
    return property.key.value;
  }
  return null;
}

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow inline styles except dynamic layout values and --nx-dyn-* custom properties",
    },
    schema: [],
    messages: {
      notObject:
        "Inline style must be an object literal of layout values ({{allowed}}) or --nx-dyn-* properties. Use tokens and Tailwind classes instead.",
      disallowedKey:
        "Inline style key '{{key}}' is not a dynamic layout value. Use tokens and Tailwind classes instead.",
    },
  },
  create(context) {
    const allowed = [...LAYOUT_KEYS].join(", ");
    return {
      JSXAttribute(node) {
        if (node.name.type !== "JSXIdentifier" || node.name.name !== "style") return;
        const value = node.value;
        const expression =
          value && value.type === "JSXExpressionContainer" ? unwrap(value.expression) : null;
        if (!expression || expression.type !== "ObjectExpression") {
          context.report({ node, messageId: "notObject", data: { allowed } });
          return;
        }
        for (const property of expression.properties) {
          if (property.type !== "Property") {
            context.report({ node: property, messageId: "notObject", data: { allowed } });
            continue;
          }
          const key = keyName(property);
          if (key === null || !(LAYOUT_KEYS.has(key) || key.startsWith(DYNAMIC_PREFIX))) {
            context.report({
              node: property,
              messageId: "disallowedKey",
              data: { key: key ?? "<computed>" },
            });
          }
        }
      },
    };
  },
};
