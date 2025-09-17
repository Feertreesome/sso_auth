import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

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
    return (
      <html lang="en">
        <body className="antialiased">
          <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-center text-slate-200">
            <div className="max-w-md space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-8 shadow-lg">
              <h1 className="text-lg font-semibold text-white">
                Нужен NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
              </h1>
              <p className="text-sm text-slate-300">
                Добавьте publishable key Clerk в <code>.env.local</code>, затем перезапустите
                приложение. Без него авторизация не будет работать.
              </p>
            </div>
          </main>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body className="antialiased">
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
