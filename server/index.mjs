import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import passport from 'passport';
import {
  clerkClient as defaultClerkClient,
  clerkMiddleware,
  createClerkClient,
  getAuth,
  requireAuth,
} from "@clerk/express";
import { engine } from 'express-handlebars';
import { auth } from 'express-openid-connect';
import pkg from '@clerk/clerk-js';
const {Clerk} = pkg;


const envPath = process.env.CLERK_ENV_FILE || ".env.local";
dotenv.config({ path: envPath });

const publishableKey = process.env.CLERK_PUBLISHABLE_KEY;

const requiredEnv = ["CLERK_SECRET_KEY"];

requiredEnv.forEach((key) => {
  if (!process.env[key]) {
    console.warn(`Missing environment variable ${key}. The server may not function correctly.`);
  }
});

const config = {
  authRequired: false,
  auth0Logout: true,
  secret: 'Hx4-b2GDhNWvI-3lceHAHiL_CcpLL9REefdlacS8PbOmc4pblXsm_FXOFmk2Wt0b',
  baseURL: 'http://localhost:3000',
  clientID: 'uSPkRxCveTTwK0lXlP23ybJmyYGTWo1a',
  issuerBaseURL: 'https://dev-41nv03fx0xnu5lpj.us.auth0.com'
};

const clerk2 = new Clerk(publishableKey);

const app = express();
const port = Number.parseInt(process.env.PORT ?? "4000", 10);
const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:3000";

const rawClerkApiUrl = process.env.CLERK_API_URL?.trim();
const sanitizedClerkApiUrl = rawClerkApiUrl
  ? rawClerkApiUrl.replace(/\/?v1\/?$/, "") || undefined
  : undefined;
const clerkApiBaseUrl = sanitizedClerkApiUrl || "https://api.clerk.com";

const clerk = process.env.CLERK_SECRET_KEY
  ? createClerkClient({
      secretKey: process.env.CLERK_SECRET_KEY,
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
      apiUrl: sanitizedClerkApiUrl,
    })
  : defaultClerkClient;

app.use(cors({ origin: clientOrigin, credentials: true }));
app.use(express.json());
app.use(
  clerkMiddleware({
    clerkClient: clerk,
  })
);
app.use(auth(config));
app.engine('handlebars', engine());
app.set('view engine', 'handlebars');
app.set('views', './views');

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// start authentication request
app.get('/auth', (req, res, next) => {
  passport.authenticate('oidc', { acr_values: 'urn:grn:authn:no:bankid' })(req, res, next);
});

// authentication callback
app.get('/auth/callback', (req, res, next) => {
  passport.authenticate('oidc', {
    successRedirect: '/users',
    failureRedirect: '/'
  })(req, res, next);
});

app.post('/login', async (req, res) => {
  const { identifier, password } = req.body || {};
  console.log(identifier, 'identifier')
  console.log(password, 'password')
  const url = clerk2
  const signInAttempt = await clerk2.client?.signIn.create({
    identifier,
    password,
  })

  console.log(url, 'url');
  console.log(signInAttempt, 'signInAttempt');

  if (signInAttempt.status === 'complete') {
    await clerk2.setActive({
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
    console.error(JSON.stringify(signInAttempt, null, 2))
  }
});

app.get("/auth/me", requireAuth(), async (req, res) => {
  const auth = getAuth(req);

  if (!auth?.userId) {
    return res.status(401).json({ error: "No active Clerk session found" });
  }

  try {
    const user = await clerk.users.getUser(auth.userId);
    return res.json({
      user,
      sessionId: auth.sessionId,
      actor: auth.actor,
    });
  } catch (error) {
    console.error("Failed to load authenticated user", error);
    return res.status(500).json({
      error: "Unable to load authenticated user",
    });
  }
});

app.get('/sign-in', (req, res) => {
  res.render('sign-in')
})

app.post("/auth/login", async (req, res) => {
  const { identifier, password } = req.body || {};

  if (typeof identifier !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Both identifier and password are required" });
  }
  if (!process.env.CLERK_SECRET_KEY) {
    return res.status(500).json({ error: "CLERK_SECRET_KEY is required" });
  }

  try {
    // 1) Находим юзера по email И/ИЛИ username (identifier может быть тем или тем)
    const { data: byEmail } = await clerk.users.getUserList({
      emailAddress: [identifier],
      limit: 1,
    });
    const { data: byUsername } = await clerk.users.getUserList({
      username: [identifier],
      limit: 1,
    });

    const user = (byEmail && byEmail[0]) || (byUsername && byUsername[0]);
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // 2) Проверяем пароль
    await clerk.users.verifyPassword({ userId: user.id, password });

    // 3) Создаём одноразовый sign-in token (ticket) — хватит 10 минут
    const token = await clerk.signInTokens.createSignInToken({
      userId: user.id,
      expiresInSeconds: 600,
    });

    // 4) Возвращаем ticket фронту
    return res.json({ ticket: token.token });
  } catch (err) {
    // Любую ошибку (включая неверный пароль) — как 401
    return res.status(401).json({
      error: "Invalid credentials",
      details: err?.errors ?? undefined,
    });
  }
});

app.get("/auth/jwt", clerkMiddleware(), requireAuth(), async (req, res) => {
  try {
    const { sessionId } = req.auth();
    const { jwt } = await clerk.sessions.getToken(sessionId);
    res.json({ access_token: jwt, token_type: "bearer" });
  } catch {
    res.status(400).json({ error: "error" });
  }
});

//Кодекс наваял нихуя не работает а getUserList вообще достает 1 узера хотя их 2
// app.post("/auth/login", async (req, res) => {
//   const { identifier, password } = req.body || {};
//
//   if (typeof identifier !== "string" || typeof password !== "string") {
//     return res.status(400).json({ error: "Both identifier and password are required" });
//   }
//
//   if (!process.env.CLERK_SECRET_KEY) {
//     return res
//       .status(500)
//       .json({ error: "CLERK_SECRET_KEY is required to call Clerk APIs" });
//   }
//
//   try {
//     const signInEndpoint = new URL("/v1/sign_ins", clerkApiBaseUrl).toString();
//
//     const fapi = 'https://ace-kiwi-59.clerk.accounts.dev';
//
//     const response = await fetch(`${fapi}/v1/client/sign_ins`, {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/x-www-form-urlencoded'
//       },
//       body: new URLSearchParams({
//         identifier,
//         password
//       })
//     })
//
//     let resp
//     try {
//       resp = await response.json();
//     } catch (parseError) {
//       console.error("Unable to parse response.json()!", parseError);
//     }
//
//     const signInId = resp?.response.id;
//
//     console.log(signInId, 'signInId')
//
//     const r1 = await fetch(`${fapi}/v1/client/sign_ins/${signInId}/attempt_first_factor`, {
//       method: "POST",
//       headers: { "Content-Type": "application/x-www-form-urlencoded" },
//       body: new URLSearchParams({ strategy: "password", password }),
//       credentials: 'include'
//     });
//
//     let payload;
//     try {
//       payload = await r1.json();
//     } catch (parseError) {
//       console.error("Unable to parse Clerk sign-in response", parseError);
//     }
//
//     if (payload.status === "complete") {
//       await fetch(`${fapi}/v1/client/sessions/${s.created_session_id}/touch`, {
//         method: "POST",
//         headers: { "Content-Type": "application/x-www-form-urlencoded"},
//         credentials: 'include'
//       });
//     }
//     // const s1 = await r1.json();
//     // console.log(s1,'s1');
//
//     if (!r1.ok || !payload) {
//       const errorMessage =
//         payload?.errors?.[0]?.message ||
//         payload?.message ||
//           r1.statusText ||
//         "Clerk API request failed";
//
//       return res.status(r1.status || 500).json({
//         error: errorMessage,
//         details: payload?.errors ?? payload ?? null,
//       });
//     }
//
//     if (payload.status !== "complete") {
//       return res.status(401).json({
//         error: "Additional verification is required to complete sign in",
//         status: payload.status,
//         details: payload,
//       });
//     }
//
//     const sessionId = payload.created_session_id || payload.session_id;
//
//     if (!sessionId) {
//       return res.status(500).json({
//         error: "Clerk did not return a session identifier",
//         details: payload,
//       });
//     }
//
//     let sessionToken = payload.created_session_jwt || payload.session_jwt || null;
//     if (!sessionToken) {
//       try {
//         const tokenResponse = await clerk.sessions.getToken(sessionId);
//         sessionToken = tokenResponse?.jwt || null;
//       } catch (tokenError) {
//         console.warn("Failed to fetch session token", tokenError);
//       }
//     }
//
//     let user;
//     const userId = payload.user_id;
//     if (userId) {
//       try {
//         const clerkUser = await clerk.users.getUser(userId);
//         user = clerkUser?.toJSON?.() ?? clerkUser;
//       } catch (userError) {
//         console.warn("Unable to load user profile", userError);
//       }
//     }
//
//     return res.json({
//       message: "Successfully signed in",
//       status: payload.status,
//       sessionId,
//       userId,
//       sessionToken,
//       user,
//     });
//   } catch (error) {
//     console.error("Login failed", error);
//     return res.status(500).json({
//       error: error instanceof Error ? error.message : "Failed to sign in",
//     });
//   }
// });

app.post("/auth/verify-session", async (req, res) => {
});

app.listen(port, () => {
  console.log(`Node auth server listening on http://localhost:${port}`);
  console.log(`Allowing requests from ${clientOrigin}`);
});
