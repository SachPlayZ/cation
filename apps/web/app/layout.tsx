import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Cation | Private Financial Permissions for AI Agents",
  description:
    "Authorization layer for agentic finance on Canton Network. The AI proposes. The mandate decides.",
  openGraph: {
    title: "Cation | Private Financial Permissions for AI Agents",
    description:
      "Programmable financial authority for AI agents, enforced on-ledger as Daml contracts.",
    url: "/",
    siteName: "Cation",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Cation, private authority for agentic finance",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Cation | Private Financial Permissions for AI Agents",
    description:
      "Programmable financial authority for AI agents, enforced on-ledger as Daml contracts.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <body className="bg-canvas text-ink min-h-[100dvh] font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
