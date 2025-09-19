import type { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import CredentialsProvider from "next-auth/providers/credentials";

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

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.API_BASE_URL ?? "";

function buildFullName(response: LoginResponse) {
  const first = response.user?.first_name;
  const last = response.user?.last_name;

  if (first && last) {
    return `${first} ${last}`.trim();
  }

  return first ?? last ?? response.user?.username ?? null;
}

async function authorizeWithCredentials(credentials?: Record<string, unknown>) {
  if (!credentials) {
    throw new Error("Не переданы учетные данные");
  }

  const identifier = credentials.identifier;
  const password = credentials.password;

  if (typeof identifier !== "string" || typeof password !== "string") {
    throw new Error("Нужно указать email и пароль");
  }

  if (!apiBaseUrl) {
    throw new Error(
      "NEXT_PUBLIC_API_BASE_URL не настроен. Добавьте адрес Node сервера в .env.local",
    );
  }

  const endpoint = `${apiBaseUrl.replace(/\/$/, "")}/auth/login`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ identifier, password }),
  });

  let data: LoginResponse | null = null;

  try {
    data = (await response.json()) as LoginResponse;
  } catch {
    data = null;
  }

  if (!response.ok || !data) {
    const errorMessage = data?.error ?? "Не удалось подтвердить учетные данные";
    throw new Error(errorMessage);
  }

  if (!data.sessionId) {
    throw new Error("Сервер не вернул sessionId Clerk");
  }

  return {
    id: data.user?.id ?? data.sessionId,
    email:
      data.user?.email_addresses?.[0]?.email_address ??
      (identifier.includes("@") ? identifier : null),
    name: buildFullName(data),
    sessionId: data.sessionId,
    sessionToken: data.sessionToken,
    clerkUserId: data.user?.id,
  };
}

export const nextAuthOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
      allowDangerousEmailAccountLinking: true,
    }),
    CredentialsProvider({
      id: "credentials",
      name: "Email и пароль",
      credentials: {
        identifier: {
          label: "Email",
          type: "text",
          placeholder: "you@example.com",
        },
        password: { label: "Пароль", type: "password" },
      },
      authorize: authorizeWithCredentials,
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (account?.provider === "github" && user) {
        token.githubProfile = {
          id: account.providerAccountId,
        };
      }

      if (user && "sessionId" in user) {
        token.sessionId = (user as Record<string, unknown>).sessionId;
        token.sessionToken = (user as Record<string, unknown>).sessionToken;
        token.clerkUserId = (user as Record<string, unknown>).clerkUserId;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user = {
          ...session.user,
          clerkUserId: token.clerkUserId as string | undefined,
          clerkSessionId: token.sessionId as string | undefined,
        } as typeof session.user & {
          clerkUserId?: string;
          clerkSessionId?: string;
        };
      }

      if (token.sessionToken) {
        (session as typeof session & { clerkSessionToken?: string }).clerkSessionToken =
          token.sessionToken as string | undefined;
      }

      if (token.githubProfile) {
        (session as typeof session & { githubProfile?: unknown }).githubProfile =
          token.githubProfile;
      }

      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
