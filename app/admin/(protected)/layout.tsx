import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ADMIN_COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import LogoutButton from "./logout-button";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies();
  const authed = verifySessionToken(cookieStore.get(ADMIN_COOKIE_NAME)?.value);

  if (!authed) redirect("/admin/login");

  return (
    <div className="min-h-screen bg-sand">
      <header className="border-b border-line bg-paper px-5 py-4">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-brown-dark">LazyDog Surf — Admin</h1>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-semibold">
            <Link href="/admin/calendar" className="hover:underline">Calendar</Link>
            <Link href="/admin/settings" className="hover:underline">Settings</Link>
            <Link href="/admin/customer-data" className="hover:underline">Customer data</Link>
            <Link href="/" className="hover:underline">Booking Page</Link>
            <LogoutButton />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-8">{children}</main>
    </div>
  );
}
