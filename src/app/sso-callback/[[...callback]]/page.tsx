import type { Metadata } from "next";
import { AuthenticateWithRedirectCallback, ClerkLoaded, ClerkLoading } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "Завершаем авторизацию",
};

export default function SSOCallbackPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-8 text-slate-50">
      <div className="max-w-md space-y-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center shadow-lg">
        <ClerkLoading>
          <p className="text-sm text-slate-400">Завершаем OAuth перенаправление...</p>
        </ClerkLoading>
        <ClerkLoaded>
          <AuthenticateWithRedirectCallback redirectUrl="/" />
          <p className="text-sm text-slate-300">
            Если вас не перенаправило автоматически, откройте главную страницу вручную.
          </p>
        </ClerkLoaded>
      </div>
    </div>
  );
}
