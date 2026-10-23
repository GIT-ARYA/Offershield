
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OfferShield | Check Suspicious Job Offers",
  description:
    "Examine suspicious job offers and recruiter messages to understand potential warning signs before you trust them.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
