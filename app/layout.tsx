import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AMINA AI",
  description: "Advanced AI Companion",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-black text-white">{children}</body>
    </html>
  );
}