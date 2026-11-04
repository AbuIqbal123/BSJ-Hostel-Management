/** Signup field checks and course list for onboarding. */

import { PASSWORD_RULES } from "@/password-rules";

export const ONBOARD_COURSES = [
  "BA LLB",
  "LLM",
  "BSc Industrial Chemistry",
  "MSc Industrial Chemistry",
  "MSc Wildlife and Biodiversity",
  "MTech Agricultural Process and Food Engineering",
  "MBA",
  "MBA International Business",
  "PG Islamic Banking and Finance",
  "BA Theology (Sunni)",
  "BA Theology (Shia)",
  "PhD Agriculture",
  "PhD Arts",
  "PhD Commerce",
  "PhD Law",
  "PhD Life Sciences",
  "PhD Theology",
] as const;

export const ONBOARD_PHONE_LINE = "Use an Indian mobile: +91 and exactly 10 digits";

export function onboardDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, 10);
}

export function onboardE164(value: string): string {
  return `+91${onboardDigits(value)}`;
}

export function onboardPersonError(value: string, empty: string): string | null {
  const length = value.trim().length;
  if (length < 1) {
    return empty;
  }
  if (length > 120) {
    return "Use 120 characters or fewer";
  }
  return null;
}

export function onboardEnrolmentError(value: string): string | null {
  const length = value.trim().length;
  if (length < 1) {
    return "Enter your enrolment number";
  }
  if (length > 40) {
    return "Use 40 characters or fewer";
  }
  return null;
}

export function onboardFailingPasswordRule(value: string): string | null {
  for (const rule of PASSWORD_RULES) {
    if (!rule.test(value)) {
      return rule.label;
    }
  }
  return null;
}

export function onboardPhoneError(value: string): string | null {
  if (!/^\d{10}$/.test(onboardDigits(value))) {
    return ONBOARD_PHONE_LINE;
  }
  return null;
}

export function isOnboardCourse(value: string | null): value is (typeof ONBOARD_COURSES)[number] {
  return value !== null && (ONBOARD_COURSES as readonly string[]).includes(value);
}
