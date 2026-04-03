import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import { ToastProvider } from "@/components/shell/toast-provider";
import { QueryProvider } from "@/lib/query-client";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Secured Terminal — Admin Panel",
  description: "Flent Secured admin dashboard for user management, payments, and verification oversight.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${plusJakarta.variable} ${jetbrainsMono.variable} antialiased`}>
        <QueryProvider>
          {children}
        </QueryProvider>
        <ToastProvider />
      </body>
    </html>
  );
}
