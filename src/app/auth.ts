import NextAuth from "next-auth";
import Auth0 from "next-auth/providers/auth0";

export const { handlers, auth, signIn, signOut } = NextAuth({
    debug: false,
    session: { strategy: "jwt" }, // удобнее для масштабирования
    providers: [
        Auth0({
            issuer: process.env.AUTH0_ISSUER!,             // https://YOUR_TENANT.eu.auth0.com
            clientId: process.env.AUTH0_CLIENT_ID!,
            clientSecret: process.env.AUTH0_CLIENT_SECRET!,
            // audience можно указать в issuer/domain через правила IdP или в callbacks ниже
        }),
        // Okta/Azure AD/Keycloak — просто замените провайдера
    ],
    callbacks: {
        async jwt({ token, account }) {
            // один раз на логине сохраним «сырые» токены IdP (access_token/id_token/ttl)
            if (account) {
                token.access_token = account.access_token;
                token.id_token = account.id_token;
                token.expires_at = account.expires_at; // unix seconds
            }
            return token;
        },
        async session({ session, token }) {
            // прокинем в сессию access_token, если нужно ходить в ваш API
            (session as any).access_token = token.access_token;
            return session;
        },
    },
    // при необходимости: pages: { signIn: "/login" }   // кастомная страница
});
