/** Corner scale from docs/design/design-system.md §4. Cards use 20–24. */
export const radius = {
  r0: 0,
  r12: 12,
  r14: 14,
  r16: 16,
  r20: 20,
  r22: 22,
  r24: 24,
  r28: 28,
  pill: 999,
} as const;

export const radiusScale = [0, 12, 14, 16, 20, 21, 22, 23, 24, 28, 999] as const;
