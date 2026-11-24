import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lazy Dog Surf",
  description: "Surf lesson & board rental booking — Lazy Dog",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sk">
      <body>{children}</body>
    </html>
  );
}
