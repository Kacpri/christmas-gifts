import type { Metadata, Viewport } from "next";
import { Inter, Lobster } from "next/font/google";

import { AuthCodeExchanger } from "@/components/auth-code-exchanger";
import { PwaRegister } from "@/components/pwa-register";
import { Snow } from "@/components/snow";
import { ThemeSync } from "@/components/theme-sync";

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
  title: "Świąteczna Tablica",
  description: "Świąteczna tablica do wymiany prezentów",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Świąteczna Tablica",
  },
};

export const viewport: Viewport = {
  themeColor: "#0d4024",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pl"
      className={`${inter.variable} ${lobster.variable} h-dvh antialiased`}
    >
      <body className="min-h-dvh flex flex-col overflow-x-hidden">
        <script
          dangerouslySetInnerHTML={{
            __html: "(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(!t)localStorage.setItem('theme',d?'dark':'light');document.documentElement.setAttribute('data-theme',d?'dark':'light');}catch(e){}})();",
          }}
        />
        <Snow />
        <ThemeSync />
        <AuthCodeExchanger />
        <PwaRegister />
        <div className="app-shell flex flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
