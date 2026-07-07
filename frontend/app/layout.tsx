import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PronounceRight — AI Pronunciation Coach",
  description:
    "Upload or record 30-45 seconds of English speech and get an instant pronunciation score with word-level and phoneme-level feedback.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <header className="border-b border-[var(--border)]">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
            <Link href="/" className="font-semibold text-[var(--text-primary)]">
              PronounceRight
            </Link>
            <Link href="/privacy" className="text-sm text-[var(--text-secondary)] hover:underline">
              Privacy
            </Link>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-[var(--border)] py-6 text-center text-xs text-[var(--text-muted)]">
          Built for the Livo AI SWE assessment. Audio is processed in memory and never stored.
        </footer>
      </body>
    </html>
  );
}
