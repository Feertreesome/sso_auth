import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "Clerk SSO authentication demo",
  description:
    "Example Next.js application demonstrating Clerk SSO alongside password login handled by a Node.js server.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY. Ensure it is defined in your environment."
    );
  }

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ClerkProvider
          publishableKey={publishableKey}
          afterSignInUrl="/"
          afterSignUpUrl="/"
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
