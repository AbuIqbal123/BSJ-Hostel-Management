/** Where signup sends her after the hall refuses the form. */

export const ROOM_FULL_MESSAGE = "This room already has as many residents as it has beds";

const ENROLMENT_TAKEN = "That enrolment number is already an account";

export type SignupRecovery = {
  step: 0 | 2;
  refetchRooms: boolean;
};

export function signupRecovery(message: string): SignupRecovery | null {
  if (message === ENROLMENT_TAKEN) {
    return { step: 0, refetchRooms: false };
  }
  if (message === ROOM_FULL_MESSAGE) {
    return { step: 2, refetchRooms: true };
  }
  return null;
}
