import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "../components/Sidebar";
import ImpersonationBanner from "../components/ImpersonationBanner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gastron - Nabavka",
  description: "Powered by Gastron Systems",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="sr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-screen bg-slate-50 text-slate-900 font-sans relative">
        <ImpersonationBanner />
        <Sidebar />
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto relative z-0">
          {children}
        </main>
      </body>
    </html>
  );
}