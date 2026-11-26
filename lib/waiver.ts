// ─────────────────────────────────────────────────────────────────────────────
// Liability waiver shown (and required) at the end of every booking.
//
// Bump WAIVER_VERSION whenever the text changes: each reservation stores the
// version the customer accepted, so you can always tell which wording applied.
//
// Note: this is a standard assumption-of-risk / release template. Have it
// reviewed by a lawyer licensed in India before relying on it — a release
// that tries to exclude gross negligence or wilful misconduct is generally
// unenforceable, which is why clause 6 carves those out.
// ─────────────────────────────────────────────────────────────────────────────

export const WAIVER_VERSION = "2026-11-26";

export const WAIVER_TITLE = "Acknowledgement of Risk, Release of Liability and Indemnity";

export const WAIVER_CLAUSES: string[] = [
  "Voluntary participation. I am taking part in the surf lesson provided by LazyDog Surf (\"the Organiser\") voluntarily and of my own free will, on behalf of myself and every person listed in this booking.",
  "Inherent risks. I understand that surfing and water activities carry inherent risks that cannot be eliminated even with reasonable care, including but not limited to: drowning or near-drowning; injury from waves, rip currents, shallow water, reefs, rocks or the sea floor; collision with surfboards, fins, leashes or other people; contact with marine life; sunburn, heat exhaustion and dehydration; and changing weather and sea conditions. I knowingly and freely assume all such risks.",
  "Health and fitness. I confirm that every participant is in good health and physically fit to take part, and has no medical condition, injury, pregnancy or medication that could affect their safety in the water, unless I have told the Organiser in writing before the lesson. I confirm that the swimming ability, age and weight I have given for each participant are true and accurate.",
  "Instructions and conduct. Every participant will follow the instructions of the instructor at all times, wear the equipment provided, and stay within the designated area. The Organiser may refuse or end participation at any time, without refund, if it considers that conditions or a participant's behaviour, health or ability make it unsafe.",
  "Release of liability. To the fullest extent permitted by applicable law, I release, waive and discharge the Organiser, its owners, instructors, employees and agents from all liability, claims, demands and causes of action for any personal injury, illness, death, or loss of or damage to property arising out of or in connection with participation in the lesson, including claims arising from ordinary negligence.",
  "Exclusions. Nothing in this agreement excludes or limits liability for death or personal injury caused by gross negligence or wilful misconduct, or any other liability that cannot be excluded or limited under applicable law.",
  "Indemnity. I agree to indemnify and hold harmless the Organiser against any claim brought by me, a participant in my booking, or anyone claiming on their behalf, arising from a breach of this agreement or from information I provided being untrue.",
  "Medical treatment. I authorise the Organiser to arrange first aid and emergency medical treatment for any participant if needed, and I accept responsibility for any resulting costs. I understand that the Organiser does not provide personal accident, medical or travel insurance, and that each participant is responsible for their own insurance.",
  "Personal belongings. The Organiser is not responsible for the loss of, theft of or damage to personal belongings.",
  "Minors. Where a participant is under 18 years of age, I confirm that I am their parent or legal guardian, or am authorised by them, and I accept this agreement on the minor's behalf.",
  "Governing law. This agreement is governed by the laws of India. The courts of Goa shall have exclusive jurisdiction over any dispute arising from it. If any provision is held invalid or unenforceable, the remaining provisions shall continue in full force and effect.",
  "Acknowledgement. I have read and understood this agreement, I am at least 18 years old, and I am accepting it on behalf of myself and every participant in this booking.",
];

export const WAIVER_CHECKBOX_LABEL =
  "I have read and agree to the Acknowledgement of Risk, Release of Liability and Indemnity on behalf of myself and every participant in this booking.";
