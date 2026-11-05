import type { Metadata } from "next";
import { Inter, Lobster } from "next/font/google";

import { AuthCodeExchanger } from "@/components/auth-code-exchanger";
import { Snow } from "@/components/snow";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
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
      className={`${inter.variable} ${lobster.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Snow />
        <AuthCodeExchanger />
        <div className="app-shell flex flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
