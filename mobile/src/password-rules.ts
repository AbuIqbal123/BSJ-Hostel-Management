export const PASSWORD_RULES: { label: string; test: (value: string) => boolean }[] = [
  { label: "Use at least 10 characters.", test: (value) => value.length >= 10 },
  {
    label: "Include an uppercase letter, a lowercase letter, a number, and a symbol.",
    test: (value) =>
      /[A-Z]/.test(value) &&
      /[a-z]/.test(value) &&
      /[0-9]/.test(value) &&
      /[^A-Za-z0-9]/.test(value),
  },
];
