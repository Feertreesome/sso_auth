import type { NextAuthOptions } from "next-auth";
import jwt from "jsonwebtoken"
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

  const user = { id: "1", name: "ebash.v2.1@gmail", email: "jsmith@example.com" };

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

  // const endpoint = `${apiBaseUrl.replace(/\/$/, "")}/auth/login`;
  //
  // const response = await fetch(endpoint, {
  //   method: "POST",
  //   headers: {
  //     "Content-Type": "application/json",
  //   },
  //   body: JSON.stringify({ identifier, password }),
  // });

  // let data: LoginResponse | null = null;
  //
  // try {
  //   data = (await response.json()) as LoginResponse;
  // } catch {
  //   data = null;
  // }
  //
  // if (!response.ok || !data) {
  //   const errorMessage = data?.error ?? "Не удалось подтвердить учетные данные";
  //   throw new Error(errorMessage);
  // }
  //
  // if (!data.sessionId) {
  //   throw new Error("Сервер не вернул sessionId Clerk");
  // }

  return user;
}

export const nextAuthOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID ?? "Ov23li60WGCXdAYHLdDW",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "0a5bcb1f0611afb193ed6cf5f79b15b05dad1ffc",
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
  jwt: {
    //Кастомно делаем токены,
    // можно к примеру попробовать гинерить его на беке и тулить сюда но скорре всего это говно
    //https://next-auth.js.org/configuration/nextjs#custom-jwt-decode-method
    async encode({ secret, token }) {
      const JWT = jwt.sign(token, secret)
      console.log(JWT, 'My custom jwt');
      return JWT;
    },
    async decode({ secret, token }) {
      const JWT = jwt.verify(token, secret)
      console.log(JWT, 'decode JWT');
      return JWT;
    },
  },
  callbacks: {
    async jwt({ token, user, account }) {
      // Можем впихивать все что нам нужно в токен
      console.log(token, '======= token =======')
      if (user) {
        token.sub = user.id;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      //Аутентифицированная сессия и ее токен
      console.log(token, 'token in session');
      (session.user as any).id = token.sub;
      (session as any).role = token.role;
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
