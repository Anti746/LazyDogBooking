import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LazyDog Surf",
  description: "Surf lesson & board rental booking",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
