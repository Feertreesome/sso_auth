import NextAuth from "next-auth"
import GithubProvider from "next-auth/providers/github"
import EmailProvider from "next-auth/providers/email"

export default NextAuth({
    secret: process.env.SECRET,
    providers: [
        // OAuth authentication providers
        GithubProvider({
            clientId: process.env.GITHUB_ID,
            clientSecret: process.env.GITHUB_SECRET,
        }),
        // Sign in with passwordless email link
        EmailProvider({
            server: process.env.MAIL_SERVER,
            from: "<no-reply@example.com>",
        }),
    ],
})
