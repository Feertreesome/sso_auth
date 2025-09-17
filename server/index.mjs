import cors from "cors";
import dotenv from "dotenv";
import express from "express";

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
const apiBaseUrl = process.env.CLERK_API_URL || "https://api.clerk.com/v1";
const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:3000";

app.use(cors({ origin: clientOrigin, credentials: true }));
app.use(express.json());

const clerkFetch = async (path, init = {}) => {
  if (!process.env.CLERK_SECRET_KEY) {
    throw new Error("CLERK_SECRET_KEY is required to call Clerk APIs");
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error("Clerk API request failed");
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
};

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/auth/login", async (req, res) => {
  const { identifier, password } = req.body || {};

  if (typeof identifier !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Both identifier and password are required" });
  }

  try {
    const signInAttempt = await clerkFetch("/sign_ins", {
      method: "POST",
      body: JSON.stringify({ identifier, password }),
    });

    if (signInAttempt.status !== "complete") {
      return res.status(401).json({
        error: "Additional verification is required to complete sign in",
        status: signInAttempt.status,
        signInAttempt,
      });
    }

    const sessionId = signInAttempt.created_session_id || signInAttempt.session_id;

    if (!sessionId) {
      return res.status(500).json({
        error: "Clerk did not return a session identifier",
        signInAttempt,
      });
    }

    let sessionToken;
    try {
      const tokenResponse = await clerkFetch(`/sessions/${sessionId}/tokens`, { method: "POST" });
      sessionToken = tokenResponse.jwt || tokenResponse.token || null;
    } catch (tokenError) {
      console.warn("Failed to create session token", tokenError);
    }

    let user;
    try {
      user = await clerkFetch(`/users/${signInAttempt.user_id}`);
    } catch (userError) {
      console.warn("Unable to load user profile", userError);
    }

    return res.json({
      message: "Successfully signed in",
      sessionId,
      userId: signInAttempt.user_id,
      sessionToken,
      user,
    });
  } catch (error) {
    console.error("Login failed", error);
    if (error.data?.errors?.length) {
      return res.status(error.status || 500).json({
        error: error.data.errors[0].message,
        details: error.data.errors,
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
