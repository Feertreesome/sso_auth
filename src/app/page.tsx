"use client";

import SignInForm from "@/app/email";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ClerkProvider,
  SignOutButton,
  UserButton,
  useAuth,
  useClerk,
  useSignIn,
  useUser, SignedOut, SignInButton, SignUpButton, SignedIn,
} from "@clerk/nextjs";

type LoginResponse = {
  message?: string;
  sessionId?: string;
  sessionToken?: string | null;
  userId?: string;
  user?: {
    id?: string;
    email_addresses?: Array<{ email_address: string }>;
    first_name?: string | null;
    last_name?: string | null;
    username?: string | null;
  };
  error?: string;
  details?: unknown;
  status?: string;
};

type SessionVerificationResponse = {
  message?: string;
  session?: {
    id?: string;
    status?: string;
    userId?: string | null;
    clientId?: string | null;
    actor?: unknown;
    lastActiveAt?: number | null;
    abandonAt?: number | null;
    expireAt?: number | null;
    publicUserData?: unknown;
    authenticationFactors?: unknown;
  };
  user?: unknown;
  error?: string;
  details?: unknown;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export default function Home() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [apiResponse, setApiResponse] = useState<LoginResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jwt, setJwt] = useState<string | null>(null);
  const [verificationResponse, setVerificationResponse] =
    useState<SessionVerificationResponse | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const { sessionId, getToken } = useAuth();
  const { setActive } = useClerk();
  const { isSignedIn, user } = useUser();
  const { signIn, isLoaded: isSignInLoaded } = useSignIn();
  const lastVerifiedSessionIdRef = useRef<string | null>(null);

  const primaryEmail = useMemo(() => {
    if (!user?.primaryEmailAddress) {
      return null;
    }

    return user.primaryEmailAddress.emailAddress;
  }, [user?.primaryEmailAddress]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!isSignInLoaded) {
        setError("Clerk еще загружается. Повторите попытку через секунду.");
        return;
      }

      if (!apiBaseUrl) {
        setError(
          "NEXT_PUBLIC_API_BASE_URL is not set. Please define it so the UI knows where the Node server is running."
        );
        return;
      }

      setIsLoading(true);
      setError(null);
      setApiResponse(null);

      try {
        // const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/auth/login`, {
        //   method: "POST",
        //   headers: {
        //     "Content-Type": "application/json",
        //   },
        //   body: JSON.stringify({ identifier, password }),
        // });

        // 1) просим бэкенд проверить пароль и выдать ticket
        const r1 = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier, password }),
        });
        const body: { ticket?: string; error?: string } = await r1.json();
        if (!r1.ok || !body.ticket) {
          setError(body.error || "Не удалось войти. Проверьте данные.");
          setApiResponse(body as any);
          return;
        }

        // console.log(response, 'response');
        // const body: LoginResponse = await response.json();

        // 2) поглощаем ticket через SDK (создаст сессию в браузере)
        const s = await signIn.create({ strategy: "ticket", ticket: body.ticket });

        // if (!response.ok) {
        //   setError(body.error || "Не удалось войти. Проверьте введенные данные.");
        //   setApiResponse(body);
        //   return;
        // }
        //
        // setApiResponse(body);
        //
        // if (body.sessionId) {
        //   try {
        //     await setActive({ session: body.sessionId });
        //   } catch (activateError) {
        //     console.warn("Unable to set active Clerk session", activateError);
        //   }
        // }
        // 3) делаем сессию активной
        if (s?.createdSessionId) {
          await setActive({ session: s.createdSessionId });
          setApiResponse({ message: "Signed in", sessionId: s.createdSessionId } as any);
        } else {
          setError("Не удалось создать сессию");
        }
      } catch (networkError) {
        console.error(networkError);
        setError(
          networkError instanceof Error
            ? networkError.message
            : "Unexpected network error"
        );
      } finally {
        setIsLoading(false);
      }
    },
    [identifier, password, setActive]
  );

  const getApiJwt = useCallback(async () => {
    if (!isSignedIn) throw new Error("Not signed in");

    let sessionToken = await getToken();

    let res = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/auth/jwt`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });

    if (res.status === 401) {
      sessionToken = await getToken({ skipCache: true });
      res = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/auth/jwt`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
    }

    if (!res.ok) throw new Error(`JWT failed (${res.status})`);
    const { access_token } = await res.json();
    console.log(access_token, 'access_token');
    setJwt(access_token);
  }, [apiBaseUrl, getToken, isSignedIn]);

  const verifySessionWithServer = useCallback(async () => {
    if (!sessionId) {
      setVerificationError(
        "Нет активной сессии Clerk, чтобы подтвердить токен. Выполните вход через GitHub."
      );
      setVerificationResponse(null);
      return;
    }

    if (!apiBaseUrl) {
      setVerificationError(
        "NEXT_PUBLIC_API_BASE_URL не настроен, поэтому невозможно связаться с Node сервером для проверки токена."
      );
      setVerificationResponse(null);
      return;
    }

    setIsVerifying(true);
    setVerificationError(null);
    setVerificationResponse(null);

    try {
      let token = await getToken();

      if (!token) {
        token = await getToken({ template: "integration_fallback" });
      }

      if (!token) {
        setVerificationError(
          "Clerk не выдал JWT токен для текущей сессии. Убедитесь, что сессия активна."
        );
        return;
      }

      const response = await fetch(
        `${apiBaseUrl.replace(/\/$/, "")}/auth/verify-session`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sessionId, token }),
        }
      );

      const body: SessionVerificationResponse = await response.json();

      if (!response.ok) {
        setVerificationError(
          body.error || "Не удалось подтвердить сессию на Node сервере."
        );
        setVerificationResponse(body);
        return;
      }

      setVerificationResponse(body);
      lastVerifiedSessionIdRef.current = sessionId;
    } catch (networkError) {
      console.error(networkError);
      setVerificationError(
        networkError instanceof Error
          ? networkError.message
          : "Не удалось подтвердить сессию на Node сервере."
      );
    } finally {
      setIsVerifying(false);
    }
  }, [getToken, sessionId]);

  const sessionSub = useCallback(async () => {
    const response = await fetch(
        `${apiBaseUrl.replace(/\/$/, "")}/login`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
    );

    console.log(response, 'response sessionSub')
  }, []);

  const handleGitHubLogin = useCallback(async () => {
    if (!isSignInLoaded) {
      setError("Clerk еще загружается. Повторите попытку через секунду.");
      return;
    }

    setError(null);
    setApiResponse(null);

    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_github",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/",
      });
    } catch (oauthError) {
      console.error(oauthError);
      setError(
        oauthError instanceof Error
          ? oauthError.message
          : "Не удалось запустить авторизацию через GitHub"
      );
    }
  }, [isSignInLoaded, signIn]);

  useEffect(() => {
    if (!isSignedIn) {
      setVerificationResponse(null);
      setVerificationError(null);
      lastVerifiedSessionIdRef.current = null;
      return;
    }

    if (!sessionId || !apiBaseUrl) {
      return;
    }

    if (lastVerifiedSessionIdRef.current === sessionId) {
      return;
    }

    verifySessionWithServer();
  }, [isSignedIn, sessionId, verifySessionWithServer]);

  return (
    <div className="min-h-screen bg-slate-950 py-16 text-slate-50">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-6">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
            Clerk + Node.js
          </p>
          <h1 className="text-3xl font-semibold sm:text-4xl">
            Единая авторизация: пароль или GitHub SSO
          </h1>
          <p className="text-base text-slate-300">
            Форма ниже отправляет логин и пароль на наш Node.js сервер. Сервер
            обращается к Clerk API, создает сессию и возвращает результат.
            Справа — авторизация напрямую через Clerk и GitHub SSO.
          </p>
        </header>

        <main className="grid gap-12 md:grid-cols-2">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 shadow-lg">
            <h2 className="text-xl font-semibold text-white">
              Вход по логину и паролю
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Данные отправляются на <code className="rounded bg-slate-800 px-2 py-0.5">/auth/login</code>
              нашего Node сервера. На стороне сервера вызывается Clerk REST API
              для проверки учетных данных.
            </p>

            <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
              <label className="block text-sm font-medium text-slate-200">
                Email или username
                <input
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-base text-white outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-500/40"
                  placeholder="you@example.com"
                  autoComplete="username"
                  required
                  disabled={isLoading}
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
                  disabled={isLoading}
                />
              </label>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-lg bg-purple-500 px-4 py-3 text-base font-semibold text-white transition hover:bg-purple-400 focus:ring-2 focus:ring-purple-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? "Отправляем..." : "Войти через Node сервер"}
              </button>
            </form>

            {error && (
              <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
                {error}
              </p>
            )}

            {apiResponse && (
              <div className="mt-6 space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                  Ответ сервера
                </h3>
                <pre className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 p-4 text-xs text-slate-300">
{JSON.stringify(apiResponse, null, 2)}
                </pre>
              </div>
            )}
          </section>

          <section className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 shadow-lg">
              <h2 className="text-xl font-semibold text-white">GitHub SSO</h2>
              <p className="mt-2 text-sm text-slate-400">
                Кнопка запускает <span className="font-mono">authenticateWithRedirect</span> для
                стратегии <span className="font-mono">oauth_github</span>. По завершении OAuth
                Clerk вернется на <span className="font-mono">/sso-callback</span> и активирует
                сессию.
              </p>

              <button
                type="button"
                onClick={handleGitHubLogin}
                className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-base font-semibold text-white transition hover:border-purple-400 hover:text-purple-200 focus:ring-2 focus:ring-purple-500/40"
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

              <p className="mt-4 text-xs text-slate-500">
                Убедитесь, что провайдер GitHub включен в настройках Clerk, иначе кнопка не будет отображаться пользователю.
              </p>

              {/*<div className="mt-6 space-y-4 rounded-2xl border border-slate-800/60 bg-slate-950/40 p-4">*/}
              {/*  <div className="flex items-center justify-between gap-4">*/}
              {/*    <h3 className="text-sm font-semibold text-slate-200">*/}
              {/*      Проверка токена на Node сервере*/}
              {/*    </h3>*/}
              {/*    {isVerifying && (*/}
              {/*      <span className="text-xs text-slate-400">Проверяем...</span>*/}
              {/*    )}*/}
              {/*  </div>*/}
              {/*  <p className="text-xs text-slate-400">*/}
              {/*    После успешного GitHub входа мы автоматически запрашиваем JWT сессии через Clerk и отправляем его на*/}
              {/*    <code className="mx-1 rounded bg-slate-800 px-1.5 py-0.5">/auth/verify-session</code>*/}
              {/*    Node сервера. Ниже можно повторить проверку вручную.*/}
              {/*  </p>*/}
              {/*  <button*/}
              {/*    type="button"*/}
              {/*    onClick={verifySessionWithServer}*/}
              {/*    disabled={!isSignedIn || isVerifying}*/}
              {/*    className="inline-flex w-full items-center justify-center rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:border-purple-400 hover:text-purple-200 focus:ring-2 focus:ring-purple-500/40 disabled:cursor-not-allowed disabled:opacity-60"*/}
              {/*  >*/}
              {/*    {isVerifying*/}
              {/*      ? "Проверяем токен..."*/}
              {/*      : "Проверить текущую сессию на Node сервере"}*/}
              {/*  </button>*/}
              {/*  {!isSignedIn && (*/}
              {/*    <p className="text-xs text-slate-500">*/}
              {/*      Пройдите авторизацию через GitHub, чтобы появилось что проверять.*/}
              {/*    </p>*/}
              {/*  )}*/}
              {/*  {verificationError && (*/}
              {/*    <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">*/}
              {/*      {verificationError}*/}
              {/*    </p>*/}
              {/*  )}*/}
              {/*  {verificationResponse && (*/}
              {/*    <div className="space-y-2">*/}
              {/*      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">*/}
              {/*        Ответ проверки*/}
              {/*      </h4>*/}
              {/*      <pre className="max-h-64 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-300">{JSON.stringify(verificationResponse, null, 2)}</pre>*/}
              {/*    </div>*/}
              {/*  )}*/}
              {/*</div>*/}
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 shadow-lg">
              <h2 className="text-xl font-semibold text-white">Текущий пользователь</h2>
              {isSignedIn && user ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-800 bg-slate-950 px-4 py-3">
                    <div>
                      <p className="text-base font-semibold text-white">{user.fullName || "Без имени"}</p>
                      {primaryEmail && (
                        <p className="text-sm text-slate-400">{primaryEmail}</p>
                      )}
                    </div>
                    <UserButton afterSignOutUrl="/" />
                  </div>
                  <SignOutButton>
                    <button className="w-full rounded-lg border border-red-500/40 px-4 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-500/10">
                      Выйти
                    </button>
                  </SignOutButton>
                </div>
              ) : (
                <p className="text-sm text-slate-400">
                  Пользователь не авторизован. После успешного входа статус обновится автоматически.
                </p>
              )}
            </div>
          </section>


          <section className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 shadow-lg">
              <h2 className="text-xl font-semibold text-white">Login with redirect</h2>
              <p className="mt-2 text-sm text-slate-400">
                Используются компоненты самого Клерка при нажатии происходит редирект
                на котором происходит регистрация или логин все это настраивается в кабинете
              </p>
          <ClerkProvider>
            <html lang="en">
            <body>
            <header className="flex justify-end items-center p-4 gap-4 h-16">
              <SignedOut>
                <SignInButton />
                <SignUpButton>
                  <button className="bg-[#6c47ff] text-white rounded-full font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 cursor-pointer">
                    Sign Up
                  </button>
                </SignUpButton>
              </SignedOut>
              <SignedIn>
                <UserButton />
              </SignedIn>
            </header>
            </body>
            </html>
          </ClerkProvider>
              </div>
            <button onClick={getApiJwt}> get Api Jwt</button>
            </section>

          <SignInForm/>
        </main>
      </div>
    </div>
  );
}
