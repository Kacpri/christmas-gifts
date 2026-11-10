import type { Metadata, Viewport } from "next";
import { Inter, Lobster } from "next/font/google";

import { AuthCodeExchanger } from "@/components/auth-code-exchanger";
import { PwaRegister } from "@/components/pwa-register";
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
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Świąteczne Losowanie",
  },
};

export const viewport: Viewport = {
  themeColor: "#0d4024",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pl"
      className={`${inter.variable} ${lobster.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col overflow-x-hidden">
        <script
          dangerouslySetInnerHTML={{
            __html: "(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(!t)localStorage.setItem('theme',d?'dark':'light');document.documentElement.setAttribute('data-theme',d?'dark':'light');}catch(e){}})();",
          }}
        />
        <Snow />
        <AuthCodeExchanger />
        <PwaRegister />
        <div className="app-shell flex flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
