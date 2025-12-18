import type { Metadata } from "next";
import { Inter } from "next/font/google"; // 👈 Google Font Import
import "./globals.css";

// Font Configuration
const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AMINA AI",
  description: "Advanced AI Companion for Douaa",
  icons: {
    icon: "/Amina_logo.png", // Agar logo public folder me hai to tab icon ban jayega
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-black text-white antialiased`}>
        {children}
      </body>
    </html>
  );
}