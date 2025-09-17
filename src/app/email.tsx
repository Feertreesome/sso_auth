'use client'

import * as React from 'react'
import { useSignIn } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'

export default function SignInForm() {
    const { isLoaded, signIn, setActive } = useSignIn()
    const [email, setEmail] = React.useState('')
    const [password, setPassword] = React.useState('')
    const router = useRouter()

    // Handle the submission of the sign-in form
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!isLoaded) return

        // Start the sign-in process using the email and password provided
        try {
            const signInAttempt = await signIn.create({
                identifier: email,
                password,
            })

            // If sign-in process is complete, set the created session as active
            // and redirect the user
            if (signInAttempt.status === 'complete') {
                await setActive({
                    session: signInAttempt.createdSessionId,
                    navigate: async ({ session }) => {
                        if (session?.currentTask) {
                            // Check for tasks and navigate to custom UI to help users resolve them
                            // See https://clerk.com/docs/custom-flows/overview#session-tasks
                            console.log(session?.currentTask, 'session?.currentTask')
                            return
                        }

                        console.log(session, 'session');
                    },
                })
            } else {
                // If the status is not complete, check why. User may need to
                // complete further steps.
                console.error(JSON.stringify(signInAttempt, null, 2))
            }
        } catch (err: any) {
            // See https://clerk.com/docs/custom-flows/error-handling
            // for more info on error handling
            console.error(JSON.stringify(err, null, 2))
        }
    }

    // Display a form to capture the user's email and password
    return (
        <>
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 shadow-lg">
                <h2 className="text-xs font-semibold text-white">
                    Вход по логину и паролю без нашего сервера взято с
                    <code className="mx-1 rounded bg-slate-800 px-1.5 py-0.5">
                        https://clerk.com/docs/custom-flows/email-password
                    </code>
                </h2>

                <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
                    <label className="block text-sm font-medium text-slate-200">
                        Email или username
                        <input
                            onChange={(event) => setEmail(event.target.value)}
                            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-base text-white outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-500/40"
                            placeholder="you@example.com"
                            autoComplete="username"
                            required
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
                        />
                    </label>

                    <button
                        type="submit"
                        className="w-full rounded-lg bg-purple-500 px-4 py-3 text-base font-semibold text-white transition hover:bg-purple-400 focus:ring-2 focus:ring-purple-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        Sign in
                    </button>
                </form>
            </section>
        </>
    )
}
