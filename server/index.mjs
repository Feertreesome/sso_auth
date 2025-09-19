import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import {
  clerkClient as defaultClerkClient,
  clerkMiddleware,
  createClerkClient,
  getAuth,
  requireAuth,
} from "@clerk/express";

const envPath = process.env.CLERK_ENV_FILE || ".env.local";
dotenv.config({ path: envPath });

const requiredEnv = ["CLERK_SECRET_KEY"];

requiredEnv.forEach((key) => {
  if (!process.env[key]) {
    console.warn(`Missing environment variable ${key}. The server may not function correctly.`);
  }
});

const app = express();
const port = Number.parseInt(process.env.PORT ?? "4000", 10);
const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:3000";

const rawClerkApiUrl = process.env.CLERK_API_URL?.trim();
const sanitizedClerkApiUrl = rawClerkApiUrl
  ? rawClerkApiUrl.replace(/\/?v1\/?$/, "") || undefined
  : undefined;
const clerkApiBaseUrl = sanitizedClerkApiUrl || "https://api.clerk.com/v1";

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

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
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

//Новый тестовый
app.get("/login", async (req, res) => {
  const {login, password} = req.body;
  try {
    // Временный код для отладки OAuth — оставляем закомментированным, чтобы линтер был доволен
    // clerk.idPOAuthAccessToken;
    // clerk.signInTokens.createSignInToken
    const user = await clerk.users.createUser({
      emailAddress: login,
      password: password,
    })

    console.log(user, 'user')
    return res.json(user)
  } catch (error) {
    res.status(404).json(error)
  }
})

//Кодекс наваял нихуя не работает а getUserList вообще достает 1 узера хотя их 2
app.post("/auth/login", async (req, res) => {
  const { identifier, password } = req.body || {};

  try {
    const userList = await clerk.users.getUserList();
    console.log(userList, 'userList');
  } catch (error) {
    console.log('User list no( :', error)
  }

  if (typeof identifier !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Both identifier and password are required" });
  }

  if (!process.env.CLERK_SECRET_KEY) {
    return res
      .status(500)
      .json({ error: "CLERK_SECRET_KEY is required to call Clerk APIs" });
  }

  const secretKey = process.env.CLERK_SECRET_KEY;

  try {
    const signInEndpoint = new URL("/v1/sign_ins", clerkApiBaseUrl).toString();
    const response = await fetch(signInEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secretKey}`,
      },
      body: JSON.stringify({ identifier, password }),
    });

    let payload;
    try {
      payload = await response.json();
    } catch (parseError) {
      console.error("Unable to parse Clerk sign-in response", parseError);
    }

    if (!response.ok || !payload) {
      const errorMessage =
        payload?.errors?.[0]?.message ||
        payload?.message ||
        response.statusText ||
        "Clerk API request failed";

      return res.status(response.status || 500).json({
        error: errorMessage,
        details: payload?.errors ?? payload ?? null,
      });
    }

    if (payload.status !== "complete") {
      return res.status(401).json({
        error: "Additional verification is required to complete sign in",
        status: payload.status,
        details: payload,
      });
    }

    const sessionId = payload.created_session_id || payload.session_id;

    if (!sessionId) {
      return res.status(500).json({
        error: "Clerk did not return a session identifier",
        details: payload,
      });
    }

    let sessionToken = payload.created_session_jwt || null;
    if (!sessionToken) {
      try {
        const tokenResponse = await clerk.sessions.getToken(sessionId);
        sessionToken = tokenResponse?.jwt || null;
      } catch (tokenError) {
        console.warn("Failed to fetch session token", tokenError);
      }
    }

    let user;
    const userId = payload.user_id;
    if (userId) {
      try {
        const clerkUser = await clerk.users.getUser(userId);
        user = clerkUser?.toJSON?.() ?? clerkUser;
      } catch (userError) {
        console.warn("Unable to load user profile", userError);
      }
    }

    return res.json({
      message: "Successfully signed in",
      status: payload.status,
      sessionId,
      userId,
      sessionToken,
      user,
    });
  } catch (error) {
    console.error("Login failed", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to sign in",
    });
  }
});

app.post("/auth/verify-session", async (req, res) => {
  const { sessionId, token } = req.body || {};

  if (!process.env.CLERK_SECRET_KEY) {
    return res
      .status(500)
      .json({ error: "CLERK_SECRET_KEY is required to call Clerk APIs" });
  }

  if (typeof sessionId !== "string" || !sessionId.trim()) {
    return res.status(400).json({ error: "sessionId is required" });
  }

  if (typeof token !== "string" || !token.trim()) {
    return res.status(400).json({ error: "token is required" });
  }

  const sanitizedSessionId = sessionId.trim();
  const sanitizedToken = token.trim();

  try {
    const verification = await clerk.sessions.verifySession(
      sanitizedSessionId,
      sanitizedToken
    );

    const sessionPayload = {
      id: verification.id,
      status: verification.status,
      abandonAt: verification.abandon_at ?? null,
      expireAt: verification.expire_at ?? null,
      lastActiveAt: verification.last_active_at ?? null,
      userId: verification.user_id ?? null,
      actor: verification.actor ?? null,
      clientId: verification.client_id ?? null,
      publicUserData: verification.public_user_data ?? null,
      authenticationFactors: verification.authentication_factors ?? null,
    };

    let user = null;

    if (sessionPayload.userId) {
      try {
        const fetchedUser = await clerk.users.getUser(sessionPayload.userId);
        user = fetchedUser?.toJSON?.() ?? fetchedUser;
      } catch (userError) {
        console.warn("Unable to load user profile during verification", userError);
      }
    }

    return res.json({
      message: "Session token verified",
      session: sessionPayload,
      user,
    });
  } catch (error) {
    console.error("Failed to verify session token", error);

    const maybeObject =
      error && typeof error === "object" ? /** @type {Record<string, any>} */ (error) : null;
    const statusCode =
      maybeObject && typeof maybeObject.status === "number"
        ? maybeObject.status
        : 500;
    const clerkErrors =
      maybeObject && Array.isArray(maybeObject.errors) ? maybeObject.errors : null;
    const errorMessage = clerkErrors?.[0]?.message || maybeObject?.message;

    return res.status(statusCode).json({
      error: errorMessage || "Failed to verify session token",
      details: clerkErrors ?? null,
    });
  }
});

app.listen(port, () => {
  console.log(`Node auth server listening on http://localhost:${port}`);
  console.log(`Allowing requests from ${clientOrigin}`);
});
