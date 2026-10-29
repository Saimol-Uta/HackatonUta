import type { Classification } from "../ports";

export interface EnrollmentDetails {
  fullName: string;
  email: string;
  phone: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

/**
 * Accepts the classifier's extraction only when it is complete and plausible: a name with at
 * least two words, a well-formed email and a phone with 7 to 15 digits. Anything else waits for
 * the bot to keep asking.
 */
export function validEnrollmentDetails(contact: Classification["contact"]): EnrollmentDetails | null {
  const fullName = contact.fullName?.replace(/\s+/g, " ").trim() ?? "";
  const email = contact.email?.trim().toLowerCase() ?? "";
  const phone = contact.phone?.replace(/[^\d+]/g, "") ?? "";
  const digits = phone.replace(/\D/g, "").length;

  if (fullName.split(" ").length < 2 || fullName.length > 120) return null;
  if (!EMAIL.test(email) || email.length > 120) return null;
  if (digits < 7 || digits > 15) return null;
  return { fullName, email, phone };
}
