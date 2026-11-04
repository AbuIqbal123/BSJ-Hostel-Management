/** Relation choices for the guest stay form. */

export const OTHER_RELATION = "Other";

export const GUEST_RELATIONS = [
  "Mother",
  "Father",
  "Sister",
  "Brother",
  "Guardian",
  "Aunt",
  "Uncle",
  "Cousin",
  "Grandmother",
  "Grandfather",
  OTHER_RELATION,
] as const;

export function guestRelationFields(relation: string): { id: string; other: string } {
  if (relation !== OTHER_RELATION && (GUEST_RELATIONS as readonly string[]).includes(relation)) {
    return { id: relation, other: "" };
  }
  return { id: OTHER_RELATION, other: relation };
}
