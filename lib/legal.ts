// ─────────────────────────────────────────────────────────────────────────────
// Who is responsible for customers' personal data (the GDPR "controller").
// FILL THESE IN before going live — they appear on the /privacy page.
// ─────────────────────────────────────────────────────────────────────────────

export const CONTROLLER = {
  name: "[Business owner's full name or company name]",
  address: "[Postal address in Goa, India]",
  email: "[privacy@your-domain.com]",
  phone: "[+91 …]",
};

/** Must match the interval in supabase/migrations/0001_init.sql (purge function). */
export const RETENTION_MONTHS = 24;

export const PRIVACY_POLICY_UPDATED = "26 November 2026";

export const isControllerFilledIn = () => !Object.values(CONTROLLER).some((v) => v.startsWith("["));
