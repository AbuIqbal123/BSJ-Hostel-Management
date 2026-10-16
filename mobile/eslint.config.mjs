import tseslint from "typescript-eslint";

/** A catch that drops the failure. Allowed only in src/safe.ts. */
const silentCatch = [
  {
    selector: "CatchClause > BlockStatement[body.length=0]",
    message: "A silent catch is allowed only in src/safe.ts. Call ignore() from there.",
  },
  {
    selector:
      "CallExpression[callee.property.name='catch'] > ArrowFunctionExpression > BlockStatement[body.length=0]",
    message: "A silent catch is allowed only in src/safe.ts. Call ignore() from there.",
  },
  {
    selector:
      "CallExpression[callee.property.name='catch'] > ArrowFunctionExpression[body.type='Identifier']",
    message: "A silent catch is allowed only in src/safe.ts. Call ignore() from there.",
  },
  {
    selector: "CallExpression[callee.property.name='catch'] > ArrowFunctionExpression[body.type='Literal']",
    message: "A silent catch is allowed only in src/safe.ts. Call readJson() or ignore() from there.",
  },
  {
    selector:
      "CallExpression[callee.property.name='catch'] > ArrowFunctionExpression[body.type='UnaryExpression']",
    message: "A silent catch is allowed only in src/safe.ts. Call ignore() from there.",
  },
];

const rawNow = {
  selector: "NewExpression[callee.name='Date'][arguments.length=0]",
  message: "new Date() reads the phone clock. Use hallNow() from format-when.ts.",
};

const parser = {
  parser: tseslint.parser,
  parserOptions: { ecmaFeatures: { jsx: true } },
};

export default [
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/safe.ts", "src/format-when.ts"],
    languageOptions: parser,
    rules: {
      "no-empty": "warn",
      "no-restricted-syntax": ["warn", ...silentCatch, rawNow],
    },
  },
  {
    files: ["src/format-when.ts"],
    languageOptions: parser,
    rules: {
      "no-empty": "warn",
      "no-restricted-syntax": ["warn", ...silentCatch],
    },
  },
  {
    files: ["src/safe.ts"],
    languageOptions: parser,
    rules: {
      "no-empty": "warn",
      "no-restricted-syntax": "off",
    },
  },
];
