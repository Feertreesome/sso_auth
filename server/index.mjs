import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { createClerkClient, isClerkAPIResponseError } from "@clerk/backend";

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

const clerk = process.env.CLERK_SECRET_KEY
  ? createClerkClient({
      secretKey: process.env.CLERK_SECRET_KEY,
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
      apiUrl: sanitizedClerkApiUrl,
    })
  : null;

app.use(cors({ origin: clientOrigin, credentials: true }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/auth/login", async (req, res) => {
  const { identifier, password } = req.body || {};

  if (typeof identifier !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Both identifier and password are required" });
  }

  if (!clerk) {
    return res
      .status(500)
      .json({ error: "CLERK_SECRET_KEY is required to call Clerk APIs" });
  }

  try {
    const signInAttempt = await clerk.signIns.create({
      identifier,
      password,
    });

    if (signInAttempt.status !== "complete") {
      return res.status(401).json({
        error: "Additional verification is required to complete sign in",
        status: signInAttempt.status,
        signInAttempt: signInAttempt.toJSON(),
      });
    }

    const sessionId = signInAttempt.createdSessionId || signInAttempt.sessionId;

    if (!sessionId) {
      return res.status(500).json({
        error: "Clerk did not return a session identifier",
        signInAttempt: signInAttempt.toJSON(),
      });
    }

    let sessionToken;
    try {
      const tokenResponse = await clerk.sessions.createToken(sessionId);
      sessionToken = tokenResponse?.jwt || tokenResponse?.token || null;
    } catch (tokenError) {
      console.warn("Failed to create session token", tokenError);
    }

    let user;
    try {
      const clerkUser = await clerk.users.getUser(signInAttempt.userId);
      user = clerkUser?.toJSON?.() ?? clerkUser;
    } catch (userError) {
      console.warn("Unable to load user profile", userError);
    }

    return res.json({
      message: "Successfully signed in",
      sessionId,
      userId: signInAttempt.userId,
      sessionToken,
      user,
    });
  } catch (error) {
    console.error("Login failed", error);
    if (isClerkAPIResponseError(error)) {
      return res.status(error.status || 500).json({
        error: error.errors?.[0]?.message || "Clerk API request failed",
        details: error.errors,
      });
    }

    return res.status(error.status || 500).json({
      error: error.message || "Failed to sign in",
    });
  }
});

app.listen(port, () => {
  console.log(`Node auth server listening on http://localhost:${port}`);
  console.log(`Allowing requests from ${clientOrigin}`);
});
