import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LazyDog Surf",
  description: "Book a 1 Day Surf Course in Goa",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
