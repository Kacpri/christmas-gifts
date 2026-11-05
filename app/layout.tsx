import type { Metadata } from "next";
import { Geist, Geist_Mono, Lobster } from "next/font/google";

import { AuthCodeExchanger } from "@/components/auth-code-exchanger";
import { Snow } from "@/components/snow";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

const lobster = Lobster({
  weight: "400",
  variable: "--font-festive",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "Świąteczne Losowanie",
  description: "Losowanie prezentów świątecznych",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pl"
      className={`${geistSans.variable} ${geistMono.variable} ${lobster.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Snow />
        <AuthCodeExchanger />
        {children}
      </body>
    </html>
  );
}
