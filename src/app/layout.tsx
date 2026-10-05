import type { Metadata, Viewport } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Providers } from "@/components/astrovia/providers";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Astrovia — Vedic Wisdom, Personal Growth",
  description:
    "Premium Vedic astrology and self-improvement. Swiss-Ephemeris precision kundli, Panchang, matching, dashas, Karma Journal, and guidance from Acharya Abhishek Sharma.",
  icons: { icon: "/logo.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FAF7F0",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${playfair.variable} ${inter.variable} antialiased bg-background text-foreground`}>
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  );
}
