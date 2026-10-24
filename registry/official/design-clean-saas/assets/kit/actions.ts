"use server";

import { validateContact, validateEmail, type FormState } from "./validate";

const text = (data: FormData, key: string) => String(data.get(key) ?? "");

/**
 * STUB: validates and pretends to send. Replace the body with your real delivery (email service,
 * CRM, database). Keep the return shape. Never log or store the message without consent.
 */
export async function submitContact(_prev: FormState, data: FormData): Promise<FormState> {
  const { ok, errors } = validateContact({
    name: text(data, "name"),
    email: text(data, "email"),
    message: text(data, "message"),
  });
  if (!ok) return { status: "error", errors };
  // TODO: send the message here.
  return {
    status: "success",
    errors: {},
    message: "Thanks. We will reply within two working days.",
  };
}

/** STUB: validates the address and pretends to subscribe. Replace with your email provider. */
export async function subscribeNewsletter(_prev: FormState, data: FormData): Promise<FormState> {
  const error = validateEmail(text(data, "email"));
  if (error) return { status: "error", errors: { email: error } };
  // TODO: add the address to your list here.
  return { status: "success", errors: {}, message: "You are on the list." };
}
