// ─────────────────────────────────────────────────────────────────────────────
// Deposit and payment details shown in the booking-request email.
// Same account and UPI QR code as in the Surf Wala project.
// ─────────────────────────────────────────────────────────────────────────────

/** Share of the total paid up front to secure the booking. */
export const DEPOSIT_RATE = 0.5;

export const BANK_DETAILS: { label: string; value: string }[] = [
  { label: "Account holder", value: "DEKO BOKO ADVENTURES LLP" },
  { label: "Bank", value: "HDFC Bank · Branch: Pernem, Goa" },
  { label: "Account number", value: "5020 010 6017210" },
  { label: "IFSC", value: "HDFC0001674" },
  { label: "Account type", value: "Current Account" },
  { label: "SWIFT", value: "HDFCINBBXXX" },
  { label: "GSTIN", value: "30AAXFD3101G1ZV" },
];

/** UPI payment QR code (image hosted on Vercel Blob). */
export const UPI_QR_IMAGE_URL = "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/222-Ue0bGicvKUtcUzaoWeCYBjz5CK09ah.jpg";

export function depositSplit(total: number): { deposit: number; balance: number } {
  const deposit = Math.round(total * DEPOSIT_RATE);
  return { deposit, balance: total - deposit };
}
