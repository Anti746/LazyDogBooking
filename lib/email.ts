// ─────────────────────────────────────────────────────────────────────────────
// Booking emails, sent from the business Gmail account (same address as the
// Surf Wala project — GMAIL_USER / GMAIL_APP_PASSWORD), labelled "LazyDog".
//
//   1. Booking request  → customer: summary, 50% deposit, bank details, UPI QR
//   2. Booking request  → us (GMAIL_USER): heads-up that a booking is waiting
//   3. Booking confirmed (admin clicks Confirm) → customer
//
// Emails are best-effort: a failure is logged and reported back, but never
// undoes or blocks the booking itself. Every value from the customer is
// HTML-escaped before it goes into an email.
// ─────────────────────────────────────────────────────────────────────────────
import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { BANK_DETAILS, UPI_QR_IMAGE_URL, depositSplit } from "@/lib/payment";
import type { Participant } from "@/lib/types";

export interface BookingEmailData {
  order_ref: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string;
  course_name: string;
  course_date: string; // YYYY-MM-DD
  course_time: string;
  participants: Participant[];
  price_per_person: number;
  subtotal: number;
  discount: number;
  total_price: number;
}

export type EmailResult = { ok: boolean; error?: string };

const FROM_NAME = "LazyDog Surf";

let cachedTransporter: Transporter | null = null;

function transporter(): Transporter | null {
  if (cachedTransporter) return cachedTransporter;
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  cachedTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
    // Fail fast: the customer is waiting on the booking screen.
    connectionTimeout: 8_000,
    greetingTimeout: 8_000,
    socketTimeout: 15_000,
  });
  return cachedTransporter;
}

export function emailConfigured(): boolean {
  return !!process.env.GMAIL_USER && !!process.env.GMAIL_APP_PASSWORD;
}

async function send(to: string, subject: string, html: string, label: string): Promise<EmailResult> {
  const t = transporter();
  if (!t) {
    console.warn(`${label}: not sent — GMAIL_USER / GMAIL_APP_PASSWORD are not configured`);
    return { ok: false, error: "Email sending is not configured" };
  }
  let lastError = "Unknown email error";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await t.sendMail({ from: `"${FROM_NAME}" <${process.env.GMAIL_USER}>`, to, subject, html });
      return { ok: true };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      // Log the label only — never the recipient address or contents.
      console.error(`${label} attempt ${attempt}/3 failed: ${lastError}`);
      if (attempt < 3) await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }
  return { ok: false, error: lastError };
}

// ── HTML helpers ─────────────────────────────────────────────────────────────

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const rs = (n: number) => `${n.toLocaleString("en-IN")} Rs`;

function prettyDate(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  return isNaN(d.getTime()) ? ymd : d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

const C = { ink: "#14171A", soft: "#6B6A66", line: "#E4E2DC", bg: "#F8F7F4", accent: "#FF4D1C", accentBg: "#FFF4EE" };

function layout(title: string, body: string): string {
  return `<!DOCTYPE html><html><body style="margin:0;padding:24px 12px;background:${C.bg};">
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border:1px solid ${C.line};border-radius:24px 0 24px 0;overflow:hidden;color:${C.ink};">
    <div style="padding:22px 24px;border-bottom:1px solid ${C.line};">
      <div style="font-size:22px;font-weight:700;letter-spacing:-0.3px;">LazyDog Surf</div>
      <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${C.soft};margin-top:4px;">Goa · India — ${esc(title)}</div>
    </div>
    <div style="padding:24px;font-size:14px;line-height:1.6;">${body}</div>
    <div style="padding:16px 24px;border-top:1px solid ${C.line};font-size:11px;color:${C.soft};">LazyDog Surf · Goa, India</div>
  </div></body></html>`;
}

function summaryHtml(b: BookingEmailData): string {
  const people = b.participants
    .map((p, i) => `<div style="color:${C.soft};font-size:13px;">Person ${i + 1} — ${p.gender === "male" ? "Male" : "Female"}, ${p.age} y, ${p.weight_kg} kg, ${p.swimmer ? "swimmer" : "non-swimmer"}</div>`)
    .join("");
  const discount = b.discount > 0
    ? `<div style="color:${C.accent};font-size:13px;">Group discount (10%) −${rs(b.discount)}</div>`
    : "";
  return `<div style="border:1px solid ${C.line};border-radius:12px;background:${C.bg};padding:16px;margin:16px 0;">
    <div style="font-weight:700;font-size:15px;">${esc(b.course_name)}</div>
    <div style="color:${C.soft};font-size:13px;margin-bottom:8px;">Ref #${esc(b.order_ref)}</div>
    <div style="font-size:14px;margin-bottom:8px;">${prettyDate(b.course_date)} · ${esc(b.course_time)}</div>
    ${people}
    <div style="margin-top:10px;color:${C.soft};font-size:13px;">${b.participants.length} × ${rs(b.price_per_person)} = ${rs(b.subtotal)}</div>
    ${discount}
    <div style="margin-top:6px;font-weight:700;font-size:15px;">Total: <span style="color:${C.accent};">${rs(b.total_price)}</span></div>
  </div>`;
}

function paymentHtml(b: BookingEmailData): string {
  const { deposit, balance } = depositSplit(b.total_price);
  const rows = BANK_DETAILS.map((d) => `<div><strong>${esc(d.label)}:</strong> ${esc(d.value)}</div>`).join("");
  return `<div style="background:${C.accentBg};border:1px solid ${C.accent};border-radius:12px;padding:14px 16px;margin-top:16px;font-size:14px;">
      Your booking is <strong>pending confirmation</strong> — a deposit of <strong>50% (${rs(deposit)})</strong> is required to secure it.
      Please include your booking reference <strong>#${esc(b.order_ref)}</strong> with the payment.<br/>
      The remaining <strong>50% (${rs(balance)})</strong> is payable on the day of the lesson.
    </div>
    <div style="border:1px solid ${C.line};border-radius:12px;padding:16px;margin-top:12px;font-size:13px;line-height:1.6;">
      <div style="font-weight:700;font-size:15px;margin-bottom:8px;">Deposit payment details</div>
      ${rows}
      <div style="text-align:center;margin-top:16px;">
        <img src="${UPI_QR_IMAGE_URL}" alt="UPI payment QR code" width="260" style="display:block;width:260px;max-width:100%;height:auto;margin:0 auto;border:1px solid ${C.line};" />
        <div style="color:${C.soft};font-size:12px;margin-top:6px;">Scan to pay with any UPI app.</div>
      </div>
    </div>`;
}

// ── 1 + 2: booking request ───────────────────────────────────────────────────

export async function sendBookingRequestEmails(b: BookingEmailData): Promise<{ customer: EmailResult; admin: EmailResult }> {
  const customerHtml = layout(
    "Reservation request",
    `<p style="font-size:16px;margin-top:0;">Hi ${esc(b.customer_name)},</p>
     <p>Thanks for booking with LazyDog Surf! We've received your reservation request. Here's a summary:</p>
     ${summaryHtml(b)}
     ${paymentHtml(b)}
     <p style="margin-top:20px;">We'll send you another email as soon as your booking is confirmed.</p>
     <p>See you in the water!</p>
     <p style="color:${C.soft};font-size:12px;">This is an automated confirmation of your booking request, not a final confirmation.</p>`,
  );

  // Only what we need to act on — the full details are in the admin dashboard.
  const adminHtml = layout(
    "New reservation",
    `<p style="margin-top:0;">A new booking request is waiting for confirmation.</p>
     <p><strong>Customer:</strong> ${esc(b.customer_name)}<br/>
        <strong>Phone:</strong> ${esc(b.customer_phone)}<br/>
        <strong>Email:</strong> ${esc(b.customer_email ?? "—")}</p>
     ${summaryHtml(b)}
     <p>Confirm it in the admin dashboard once the deposit has arrived.</p>`,
  );

  const adminAddress = process.env.GMAIL_USER ?? "";
  const [customer, admin] = await Promise.all([
    b.customer_email
      ? send(b.customer_email, `LazyDog reservation — request received (#${b.order_ref})`, customerHtml, "BOOKING REQUEST EMAIL")
      : Promise.resolve<EmailResult>({ ok: false, error: "No recipient email" }),
    adminAddress
      ? send(adminAddress, `New LazyDog reservation #${b.order_ref} — ${b.course_date} ${b.course_time}`, adminHtml, "ADMIN NOTIFICATION EMAIL")
      : Promise.resolve<EmailResult>({ ok: false, error: "GMAIL_USER is not configured" }),
  ]);
  return { customer, admin };
}

// ── 3: booking confirmed ─────────────────────────────────────────────────────

export async function sendBookingConfirmedEmail(b: BookingEmailData): Promise<EmailResult> {
  if (!b.customer_email) return { ok: false, error: "No recipient email" };
  const { balance } = depositSplit(b.total_price);
  const html = layout(
    "Reservation confirmed",
    `<p style="font-size:16px;margin-top:0;">Hi ${esc(b.customer_name)},</p>
     <p>Thank you for paying the deposit — your reservation is now <strong>confirmed</strong>.</p>
     ${summaryHtml(b)}
     <p>The remaining <strong>${rs(balance)}</strong> is payable on the day of the lesson.</p>
     <p>We look forward to seeing you in the water!</p>`,
  );
  return send(b.customer_email, `LazyDog reservation confirmed (#${b.order_ref})`, html, "BOOKING CONFIRMED EMAIL");
}
