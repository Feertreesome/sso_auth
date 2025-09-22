"use client";

import { FormEvent, useCallback, useMemo, useState } from "react";
import { signIn, signOut, useSession, SessionProvider } from "next-auth/react";

function NextAuthLoginContent() {
  const { data: session, status } = useSession();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isAuthenticated = status === "authenticated";

  const handleCredentialsSignIn = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      setIsSubmitting(true);
      setFormError(null);
      setSuccessMessage(null);

      try {
        const result = await signIn("credentials", {
          identifier,
          password,
          redirect: false,
        });

        console.log(result, 'result');

        if (result?.error) {
          setFormError(result.error);
          return;
        }

        setSuccessMessage("Успешный вход через NextAuth");
        setIdentifier("");
        setPassword("");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Не удалось выполнить вход";
        setFormError(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [identifier, password],
  );

  const handleGithubSignIn = useCallback(async () => {
    setFormError(null);
    setSuccessMessage(null);

    await signIn("github", { callbackUrl: "/" });
  }, []);

  const userEmail = useMemo(() => {
    if (session?.user?.email) {
      return session.user.email;
    }

    if (typeof session?.user === "object" && session?.user) {
      const possibleEmail = (session.user as Record<string, unknown>).email;
      return typeof possibleEmail === "string" ? possibleEmail : null;
    }

    return null;
  }, [session?.user]);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 shadow-lg">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Auth.js / NextAuth.js</h2>
          <p className="mt-1 text-sm text-slate-400">
            Локальный вход через Credentials и OAuth через GitHub в одном провайдере.
          </p>
        </div>
        {isAuthenticated ? (
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="rounded-lg border border-red-500/40 px-3 py-1.5 text-sm font-semibold text-red-200 transition hover:bg-red-500/10"
          >
            Выйти
          </button>
        ) : null}
      </div>

      <form className="mt-6 space-y-5" onSubmit={handleCredentialsSignIn}>
        <label className="block text-sm font-medium text-slate-200">
          Email или username
          <input
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-base text-white outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-500/40"
            placeholder="you@example.com"
            autoComplete="username"
            required
            disabled={isSubmitting}
          />
        </label>

        <label className="block text-sm font-medium text-slate-200">
          Пароль
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-base text-white outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-500/40"
            placeholder="Пароль"
            autoComplete="current-password"
            required
            disabled={isSubmitting}
          />
        </label>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-purple-500 px-4 py-3 text-base font-semibold text-white transition hover:bg-purple-400 focus:ring-2 focus:ring-purple-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Проверяем..." : "Войти через NextAuth"}
        </button>
      </form>

      <div className="mt-6 space-y-4">
        <button
          type="button"
          onClick={handleGithubSignIn}
          className="inline-flex w-full items-center justify-center gap-3 rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-base font-semibold text-white transition hover:border-purple-400 hover:text-purple-200 focus:ring-2 focus:ring-purple-500/40"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="h-5 w-5 fill-current"
          >
            <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.09 3.29 9.4 7.86 10.94.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.53-1.36-1.28-1.72-1.28-1.72-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.04 1.78 2.74 1.27 3.41.97.11-.76.41-1.27.74-1.56-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.47.11-3.07 0 0 .97-.31 3.18 1.18a10.95 10.95 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.6.23 2.78.11 3.07.74.81 1.19 1.84 1.19 3.1 0 4.41-2.69 5.39-5.25 5.67.42.36.8 1.06.8 2.14 0 1.55-.02 2.8-.02 3.18 0 .31.21.68.8.56A10.52 10.52 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
          </svg>
          Войти через GitHub
        </button>

        {formError ? (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            {formError}
          </p>
        ) : null}

        {successMessage ? (
          <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
            {successMessage}
          </p>
        ) : null}
      </div>

      <div className="mt-8 space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Текущая сессия NextAuth
        </h3>
        <p className="text-xs text-slate-500">
          После входа здесь появятся данные пользователя и Clerk session, возвращенная сервером.
        </p>
        <button onClick={() => {console.log(session)}}>Console session</button>
        <pre className="max-h-72 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-4 text-xs text-slate-300">
{JSON.stringify(session, null, 2)}
        </pre>
        <dl className="grid gap-3 text-xs text-slate-300 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <dt className="font-semibold text-slate-200">Статус</dt>
            <dd className="mt-1 text-slate-400">{status}</dd>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <dt className="font-semibold text-slate-200">Email</dt>
            <dd className="mt-1 text-slate-400">{userEmail ?? "—"}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

export default function NextAuthLogin() {
  return (
    <SessionProvider>
      <NextAuthLoginContent />
    </SessionProvider>
  );
}
