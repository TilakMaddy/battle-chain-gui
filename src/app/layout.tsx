import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Web3Provider } from "@/lib/wagmi/provider";
import { Nav } from "@/components/layout/nav";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BattleChain GUI",
  description: "Web interface for BattleChain Safe Harbor protocol workflows",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Web3Provider>
          <Nav />
          <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
          <Toaster richColors position="bottom-right" />
        </Web3Provider>
      </body>
    </html>
  );
}
