# Clerk SSO + Node.js password authentication

This project demonstrates how to combine [Clerk](https://clerk.com/) single sign-on with a custom Node.js server that authenticates users by login/password and hands the credentials to Clerk.

The UI is built with Next.js (App Router) and offers two parallel entry points:

- **Password form** – sends the identifier/password pair to the Node.js server (`server/index.mjs`). The server uses `@clerk/express` to talk to Clerk, forwards the credentials to Clerk's REST API, creates a session and returns its metadata to the browser.
- **"Login with GitHub"** – triggers Clerk's OAuth GitHub flow via `authenticateWithRedirect`. Once the OAuth handshake finishes Clerk redirects back to `/sso-callback` where the session is activated.

## Prerequisites

1. A Clerk application with GitHub social login enabled.
2. `CLERK_SECRET_KEY` and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` issued for the application.
3. Node.js 18+ (Node 20 is bundled with this project).

## Environment variables

Copy the example file and fill in the Clerk credentials:

```bash
cp .env.local.example .env.local
```

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Publishable key used by the Next.js client bundle. |
| `CLERK_SECRET_KEY` | Secret key used by the Node.js server when calling Clerk's REST API. |
| `CLERK_PUBLISHABLE_KEY` | Optional – only required if you reuse the publishable key on the backend. |
| `NEXT_PUBLIC_API_BASE_URL` | Base URL of the Node.js server (used by the browser to send login requests). Default: `http://localhost:4000`. |
| `CLIENT_ORIGIN` | Origin allowed to call the Node.js server. Default: `http://localhost:3000`. |
| `CLERK_API_URL` | Override Clerk's REST API endpoint. Pass the base domain (for example `https://api.clerk.com` or `https://api.eu.clerk.com`). The server trims any trailing `/v1`. |

## Available scripts

### `npm run dev`

Starts the Next.js development server on [http://localhost:3000](http://localhost:3000).

### `npm run server` / `node server`

Boots the Express server from `server/index.mjs`. The server loads the `.env.local` file (via `dotenv`) and exposes three endpoints:

- `GET /health` – simple status check.
- `GET /auth/me` – protected by `requireAuth()` from `@clerk/express`. Returns the authenticated user's profile if the request carries a valid Clerk session.
- `POST /auth/login` – accepts `{ identifier, password }`, forwards the credentials to Clerk's REST API (`POST /v1/sign_ins`) and uses the Express SDK to fetch the session token and user profile before returning the response.
- `POST /auth/verify-session` – accepts `{ sessionId, token }` and verifies the JWT issued by Clerk (for example after GitHub SSO). Returns sanitized session details and the related user record.

The Node.js server must be running for the password login form to succeed.

## Usage flow

1. Start both processes in separate terminals:

   ```bash
   npm run server
   npm run dev
   ```

2. Open [http://localhost:3000](http://localhost:3000) and fill in the login form. Credentials must exist in your Clerk instance.
3. Click **Login with GitHub** to start the SSO flow. Ensure the GitHub provider is enabled in Clerk.
4. Once Clerk redirects back to the app, the UI automatically retrieves the session JWT via `getToken()` and sends it to the Node.js server, which confirms the token through the new `/auth/verify-session` endpoint. The response is rendered in the GitHub panel, and you can repeat the check manually from the same card.
5. The right-hand panel reflects the active Clerk user and provides a sign-out button.

## Notes

- The password flow simply forwards credentials to Clerk. If the account requires additional verifications (MFA, email links, etc.) the server responds with `status` describing the required factor.
- For production usage you should add rate limiting and stronger error handling around the Node.js server.
- All UI strings are in Russian to match the original task.
