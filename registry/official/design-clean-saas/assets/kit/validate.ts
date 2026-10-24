// Pure validation shared by the form components and their server actions. Replace the rules
// with your own; keep the shape ({ ok, errors }) so the components keep working.
export type FieldErrors = Record<string, string>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(value: string): string | undefined {
  const v = value.trim();
  if (!v) return "Enter your email address.";
  if (!EMAIL.test(v)) return "Enter a valid email address, like name@company.com.";
  return undefined;
}

export interface ContactInput {
  name: string;
  email: string;
  message: string;
}

export function validateContact(input: ContactInput): { ok: boolean; errors: FieldErrors } {
  const errors: FieldErrors = {};
  if (!input.name.trim()) errors.name = "Enter your name.";
  const email = validateEmail(input.email);
  if (email) errors.email = email;
  if (input.message.trim().length < 10)
    errors.message = "Write at least a sentence (10 characters).";
  return { ok: Object.keys(errors).length === 0, errors };
}

/** What a form action returns. Kept here, not in actions.ts: a "use server" file may only export functions. */
export interface FormState {
  status: "idle" | "success" | "error";
  errors: FieldErrors;
  message?: string;
}

export const initialFormState: FormState = { status: "idle", errors: {} };
