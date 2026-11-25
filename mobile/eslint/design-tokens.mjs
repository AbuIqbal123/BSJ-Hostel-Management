/**
 * Design-scale bans for the phone app.
 * Allow-lists match mobile/src/theme/spacing.ts, radius.ts, and text.ts.
 * A spacing, radius, or fontSize literal that is really a content size
 * (the back chevron's optical pull, a QR quiet zone) may carry the comment
 * `hall-content` on that style property.
 */

const SPACING = [0, 2, 4, 8, 12, 13, 16, 20, 24, 28, 32, 40, 48];
const RADIUS = [0, 12, 14, 16, 20, 21, 22, 23, 24, 28, 999];
const TYPE_SIZE = [12, 13, 14, 15, 17, 22, 28, 34, 40];

const SPACING_KEYS = new Set([
  "margin",
  "marginTop",
  "marginBottom",
  "marginLeft",
  "marginRight",
  "marginHorizontal",
  "marginVertical",
  "marginStart",
  "marginEnd",
  "padding",
  "paddingTop",
  "paddingBottom",
  "paddingLeft",
  "paddingRight",
  "paddingHorizontal",
  "paddingVertical",
  "paddingStart",
  "paddingEnd",
  "gap",
  "rowGap",
  "columnGap",
  "top",
  "right",
  "bottom",
  "left",
]);

const RADIUS_KEYS = new Set([
  "borderRadius",
  "borderTopLeftRadius",
  "borderTopRightRadius",
  "borderBottomLeftRadius",
  "borderBottomRightRadius",
  "borderTopStartRadius",
  "borderTopEndRadius",
  "borderBottomStartRadius",
  "borderBottomEndRadius",
]);

const COLOR = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

function keyName(property) {
  if (!property.key) {
    return null;
  }
  if (property.key.type === "Identifier" && !property.computed) {
    return property.key.name;
  }
  if (property.key.type === "Literal" && typeof property.key.value === "string") {
    return property.key.value;
  }
  return null;
}

function unwrap(node) {
  let current = node;
  while (
    current &&
    (current.type === "TSAsExpression" ||
      current.type === "TSSatisfiesExpression" ||
      current.type === "ParenthesizedExpression" ||
      current.type === "ChainExpression")
  ) {
    current = current.expression;
  }
  return current;
}

function nearest(value, scale) {
  let best = scale[0];
  let distance = Math.abs(value - best);
  for (const candidate of scale) {
    const next = Math.abs(value - candidate);
    if (next < distance || (next === distance && Math.abs(candidate) > Math.abs(best))) {
      best = candidate;
      distance = next;
    }
  }
  return best;
}

function spacingTarget(value) {
  const scale = [0];
  for (const step of SPACING) {
    if (step !== 0) {
      scale.push(step, -step);
    }
  }
  return nearest(value, scale);
}

function literalSize(property, name) {
  if (property.value?.type !== "Literal" || typeof property.value.value !== "number") {
    return null;
  }
  return name === "width" || name === "height" ? property.value.value : null;
}

/** A square whose radius already closes the circle stays a pill, not a 28pt corner. */
function circleTarget(property, value) {
  const object = property.parent;
  if (!object || object.type !== "ObjectExpression") {
    return null;
  }
  let width = null;
  let height = null;
  for (const item of object.properties) {
    if (item.type !== "Property") {
      continue;
    }
    const name = keyName(item);
    if (name === "width") {
      width = literalSize(item, name);
    }
    if (name === "height") {
      height = literalSize(item, name);
    }
  }
  if (width == null || height == null || width !== height || width <= 0) {
    return null;
  }
  if (value < width / 2 - 1) {
    return null;
  }
  return 999;
}

function numericLeaves(node, out) {
  const current = unwrap(node);
  if (!current) {
    return;
  }
  if (current.type === "Literal" && typeof current.value === "number") {
    out.push({ node: current, literal: current, value: current.value });
    return;
  }
  if (
    current.type === "UnaryExpression" &&
    current.operator === "-" &&
    current.argument.type === "Literal" &&
    typeof current.argument.value === "number"
  ) {
    out.push({
      node: current,
      literal: current.argument,
      value: -current.argument.value,
    });
    return;
  }
  if (current.type === "BinaryExpression" || current.type === "LogicalExpression") {
    numericLeaves(current.left, out);
    numericLeaves(current.right, out);
    return;
  }
  if (current.type === "ConditionalExpression") {
    numericLeaves(current.consequent, out);
    numericLeaves(current.alternate, out);
  }
}

function optedOut(sourceCode, property) {
  const comments = [
    ...sourceCode.getCommentsBefore(property),
    ...sourceCode.getCommentsAfter(property),
    ...sourceCode.getCommentsInside(property),
  ];
  return comments.some((comment) => comment.value.includes("hall-content"));
}

function scaleFor(property) {
  const name = keyName(property);
  if (!name) {
    return null;
  }
  if (SPACING_KEYS.has(name)) {
    return "spacing";
  }
  if (RADIUS_KEYS.has(name)) {
    return "radius";
  }
  if (name === "fontSize") {
    return "type";
  }
  return null;
}

function targetFor(kind, property, value) {
  if (kind === "radius") {
    return circleTarget(property, value) ?? nearest(value, RADIUS);
  }
  if (kind === "type") {
    return nearest(value, TYPE_SIZE);
  }
  return spacingTarget(value);
}

function replaceWith(fixer, leaf, target) {
  if (leaf.value < 0 || (leaf.node.type === "UnaryExpression" && target < 0)) {
    if (target === 0) {
      return fixer.replaceText(leaf.node, "0");
    }
    return fixer.replaceText(leaf.literal, String(Math.abs(target)));
  }
  return fixer.replaceText(leaf.node, String(target));
}

function isPrimaryButton(node) {
  const attr = node.attributes.find(
    (item) => item.type === "JSXAttribute" && item.name?.type === "JSXIdentifier" && item.name.name === "kind",
  );
  if (!attr || attr.value == null) {
    return true;
  }
  if (attr.value.type === "Literal") {
    return attr.value.value === "primary";
  }
  if (attr.value.type === "JSXExpressionContainer") {
    const expression = attr.value.expression;
    if (expression.type === "Literal") {
      return expression.value === "primary";
    }
    return true;
  }
  return true;
}

const colorRule = {
  meta: {
    type: "problem",
    docs: { description: "Hex and rgb colours belong in src/theme." },
    schema: [],
    messages: {
      color: "Use a theme colour from src/theme/colors.ts instead of a raw colour.",
    },
  },
  create(context) {
    function check(node, raw) {
      if (typeof raw === "string" && (COLOR.test(raw) || /rgba?\(/i.test(raw))) {
        context.report({ node, messageId: "color" });
      }
    }
    return {
      Literal(node) {
        check(node, node.value);
      },
      TemplateLiteral(node) {
        if (node.expressions.length === 0) {
          check(node, node.quasis.map((part) => part.value.cooked).join(""));
        }
      },
    };
  },
};

const scaleRule = {
  meta: {
    type: "problem",
    fixable: "code",
    docs: { description: "Spacing, radius, and fontSize use the design scale." },
    schema: [],
    messages: {
      off: "{{name}} {{value}} is off the design scale. Use {{target}}.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;
    return {
      Property(node) {
        const kind = scaleFor(node);
        if (!kind || optedOut(sourceCode, node)) {
          return;
        }
        const name = keyName(node);
        const leaves = [];
        numericLeaves(node.value, leaves);
        for (const leaf of leaves) {
          const target = targetFor(kind, node, leaf.value);
          if (target === leaf.value) {
            continue;
          }
          context.report({
            node: leaf.node,
            messageId: "off",
            data: { name, value: String(leaf.value), target: String(target) },
            fix: (fixer) => replaceWith(fixer, leaf, target),
          });
        }
      },
    };
  },
};

const textInputRule = {
  meta: {
    type: "problem",
    docs: { description: "Screens use SearchField or TextField." },
    schema: [],
    messages: {
      raw: "Use SearchField or TextField. A raw TextInput stays inside src/components.",
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        if (node.name.type === "JSXIdentifier" && node.name.name === "TextInput") {
          context.report({ node, messageId: "raw" });
        }
      },
    };
  },
};

const onePrimaryRule = {
  meta: {
    type: "problem",
    docs: { description: "One filled primary HallButton on a screen." },
    schema: [{ type: "object", properties: { max: { type: "integer", minimum: 1 } }, additionalProperties: false }],
    messages: {
      many: "This screen file has {{count}} filled primary HallButtons. Keep one and set kind on the others.",
    },
  },
  create(context) {
    const max = context.options[0]?.max ?? 1;
    const primaries = [];
    return {
      JSXOpeningElement(node) {
        if (node.name.type === "JSXIdentifier" && node.name.name === "HallButton" && isPrimaryButton(node)) {
          primaries.push(node);
        }
      },
      "Program:exit"() {
        if (primaries.length <= max) {
          return;
        }
        primaries.slice(max).forEach((node) => {
          context.report({
            node,
            messageId: "many",
            data: { count: String(primaries.length) },
          });
        });
      },
    };
  },
};

const hallPlugin = {
  rules: {
    "no-raw-color": colorRule,
    "token-scale": scaleRule,
    "no-raw-text-input": textInputRule,
    "one-primary": onePrimaryRule,
  },
};

export default hallPlugin;
