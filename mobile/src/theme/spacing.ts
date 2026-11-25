/** Spacing scale from docs/design/design-system.md §4, plus the documented 2, 13, and 28. */
export const space = {
  s0: 0,
  s2: 2,
  s4: 4,
  s8: 8,
  s12: 12,
  s13: 13,
  s16: 16,
  s20: 20,
  s24: 24,
  s28: 28,
  s32: 32,
  s40: 40,
  s48: 48,
} as const;

export const spacingScale = [0, 2, 4, 8, 12, 13, 16, 20, 24, 28, 32, 40, 48] as const;
