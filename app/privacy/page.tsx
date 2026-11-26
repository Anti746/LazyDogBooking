import Link from "next/link";
import type { Metadata } from "next";
import { CONTROLLER, PRIVACY_POLICY_UPDATED, RETENTION_MONTHS, isControllerFilledIn } from "@/lib/legal";

export const metadata: Metadata = { title: "Privacy Policy — LazyDog Surf" };

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-8 font-heading text-lg font-bold text-slate">{children}</h2>;
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-surface font-sans2 text-slate">
      <div className="mx-auto max-w-2xl px-5 py-10">
        <div className="rounded-tl-[32px] rounded-br-[32px] border border-line2 bg-white p-6 text-sm leading-relaxed text-slate-soft sm:p-8">
          <Link href="/" className="font-mono2 text-[11px] uppercase tracking-widest text-slate-soft hover:text-accent">← Back to booking</Link>
          <h1 className="mt-4 font-heading text-2xl font-bold text-slate">Privacy Policy</h1>
          <p className="mt-1 font-mono2 text-[11px] uppercase tracking-widest">Last updated {PRIVACY_POLICY_UPDATED}</p>

          {!isControllerFilledIn() && (
            <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 font-semibold text-red-600">
              Draft — the controller&apos;s details below have not been filled in yet (lib/legal.ts).
            </p>
          )}

          <H>1. Who we are</H>
          <p>
            LazyDog Surf is run by {CONTROLLER.name}, {CONTROLLER.address} (&quot;we&quot;). We are the controller of the personal data
            described below. Contact us about anything in this policy at <strong>{CONTROLLER.email}</strong> or {CONTROLLER.phone}.
          </p>

          <H>2. What we collect</H>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>The person who books:</strong> name, phone / WhatsApp number and email address.</li>
            <li><strong>Each participant:</strong> gender, age, body weight and whether they can swim. We do not ask for participants&apos; names.</li>
            <li><strong>The booking:</strong> date, time, number of people, price, any notes you write, and the date and time you accepted the liability waiver.</li>
          </ul>
          <p className="mt-2">
            Please do not write medical or health information in the notes field. If something about a participant&apos;s health matters for the
            lesson, tell the instructor in person on the day.
          </p>

          <H>3. Why we use it, and on what legal basis</H>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>To provide the surf lesson you booked</strong> — confirming the booking, emailing you the booking summary and deposit payment details, contacting you about it, and choosing the right board, wetsuit and group for each participant. Legal basis: performance of a contract (GDPR Art. 6(1)(b)).</li>
            <li><strong>To keep participants safe</strong> — age, weight and swimming ability tell the instructor how to run the lesson safely. Legal basis: performance of a contract (Art. 6(1)(b)) and our legitimate interest in running safe lessons (Art. 6(1)(f)).</li>
            <li><strong>To keep a record that the liability waiver was accepted</strong>, and to establish or defend legal claims. Legal basis: our legitimate interest (Art. 6(1)(f)).</li>
          </ul>
          <p className="mt-2">We do not use your data for marketing, we do not sell it, and we do not use it for automated decision-making or profiling.</p>

          <H>4. Children</H>
          <p>
            Participants may be under 18. Their details are provided by the parent, guardian or adult making the booking, who confirms they are
            authorised to do so.
          </p>

          <H>5. Who we share it with</H>
          <p>
            Only with service providers who host this website and its database on our behalf (data processors), under a data processing agreement
            that requires them to keep the data secure and confidential. The database is hosted by Supabase; We do not share your data with anyone else
            unless the law requires us to. Booking emails are sent through Google&apos;s Gmail service.
          </p>

          <H>6. Transfers outside the EU / EEA</H>
          <p>
            We are based in India and the lessons take place in India, so we access your booking from India in order to provide the lesson you asked
            for (GDPR Art. 49(1)(b) — necessary for the performance of the contract). Our service providers protect any other transfers with the
            European Commission&apos;s Standard Contractual Clauses.
          </p>

          <H>7. How long we keep it</H>
          <p>
            We keep booking and participant data for {RETENTION_MONTHS} months after the lesson date — long enough to deal with any questions or claims
            about the lesson — and then delete it automatically. If you ask us to delete it sooner, we will, unless we need it to establish or defend
            a legal claim.
          </p>

          <H>8. How we protect it</H>
          <p>
            The data is stored in an encrypted database that the public cannot access. Only our staff can see it, through a password-protected admin
            area. Connections to this website and to the database are encrypted (HTTPS / TLS). This website does not use any tracking, advertising or
            analytics cookies, and does not load fonts, scripts or anything else from third parties.
          </p>

          <H>9. Your rights</H>
          <p>You have the right to:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>ask for a copy of the personal data we hold about you (access and portability);</li>
            <li>have inaccurate data corrected;</li>
            <li>have your data deleted;</li>
            <li>restrict or object to how we use it;</li>
            <li>complain to a data protection supervisory authority — for example in the EU country where you live.</li>
          </ul>
          <p className="mt-2">
            To use any of these rights, email <strong>{CONTROLLER.email}</strong> from the email address or phone number you booked with. We will
            reply within one month.
          </p>

          <H>10. Changes</H>
          <p>If we change this policy, we will update the date at the top of this page.</p>
        </div>
      </div>
    </div>
  );
}
