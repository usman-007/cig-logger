/**
 * Supabase speaks in its own error strings ("Invalid login credentials").
 * Ash has a voice — quiet, non-judgemental — and the login page renders these
 * straight to the user, so translate in one place.
 */
export const PASSWORD_MIN = 8;

const BY_CODE: Record<string, string> = {
  invalid_credentials: "That email and password don't match.",
  email_not_confirmed: "Check your inbox — that email hasn't been confirmed yet.",
  user_already_exists: "An account with that email already exists.",
  email_exists: "An account with that email already exists.",
  weak_password: `Password needs at least ${PASSWORD_MIN} characters.`,
  over_request_rate_limit: "Too many attempts. Give it a minute and try again.",
  over_email_send_rate_limit: "Too many emails sent. Try again in a few minutes.",
  same_password: "That's already your password — pick a different one.",
  validation_failed: "Check the email address and try again.",
};

export function authErrorMessage(error: {
  code?: string;
  message?: string;
  status?: number;
}) {
  if (error.code && BY_CODE[error.code]) return BY_CODE[error.code];
  if (error.status === 429) return BY_CODE.over_request_rate_limit;
  // Older Supabase versions don't set `code` on every error.
  const message = error.message ?? "";
  if (/invalid login credentials/i.test(message)) return BY_CODE.invalid_credentials;
  if (/already registered|already exists/i.test(message)) return BY_CODE.email_exists;
  if (/email not confirmed/i.test(message)) return BY_CODE.email_not_confirmed;
  return message || "Something went wrong. Try again.";
}
