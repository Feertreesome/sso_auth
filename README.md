# Clerk SSO + Node.js password authentication

This project demonstrates how to combine [Clerk](https://clerk.com/) single sign-on with a custom Node.js server that authenticates users by login/password and hands the credentials to Clerk.

The UI is built with Next.js (App Router) and offers two parallel entry points:

- **Password form** – sends the identifier/password pair to the Node.js server (`server/index.mjs`). The server forwards the credentials to Clerk's REST API, creates a session and returns its metadata to the browser.
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
| `CLERK_API_URL` | Override Clerk's REST API endpoint. Defaults to `https://api.clerk.com/v1`. |

## Available scripts

### `npm run dev`

Starts the Next.js development server on [http://localhost:3000](http://localhost:3000).

### `npm run server`

Boots the Express server from `server/index.mjs`. The server loads the `.env.local` file (via `dotenv`) and exposes two endpoints:

- `GET /health` – simple status check.
- `POST /auth/login` – accepts `{ identifier, password }`, calls Clerk's REST API (`/sign_ins` and `/sessions/{id}/tokens`) and returns the response.

The Node.js server must be running for the password login form to succeed.

## Usage flow

1. Start both processes in separate terminals:

   ```bash
   npm run server
   npm run dev
   ```

2. Open [http://localhost:3000](http://localhost:3000) and fill in the login form. Credentials must exist in your Clerk instance.
3. Click **Login with GitHub** to start the SSO flow. Ensure the GitHub provider is enabled in Clerk.
4. The right-hand panel reflects the active Clerk user and provides a sign-out button.

## Notes

- The password flow simply forwards credentials to Clerk. If the account requires additional verifications (MFA, email links, etc.) the server responds with `status` describing the required factor.
- For production usage you should add rate limiting and stronger error handling around the Node.js server.
- All UI strings are in Russian to match the original task.
