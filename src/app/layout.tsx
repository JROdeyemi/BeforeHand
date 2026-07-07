import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Beforehand — Before I ask for your hand... let's talk.",
  description:
    "The honest conversations couples need — private, unpressured, and surfaced together. A mirror, not a verdict.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="bg-linen text-ink antialiased">{children}</body>
    </html>
  );
}
