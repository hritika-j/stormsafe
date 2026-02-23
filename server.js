// server.js — StormSafe API server
// In production (Vercel): exported as a serverless function
// In local dev: listens on PORT

import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json({ limit: "10mb" }));

/**
 * Health check
 */
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

/**
 * GET /api/mta-alerts
 * Public MTA GTFS-RT alerts feed mirror (JSON, no auth required)
 */
app.get("/api/mta-alerts", async (_req, res) => {
  const url =
    "https://collector-otp-prod.camsys-apps.com/realtime/gtfsrt/ALL/alerts?type=json&apikey=qeqy84JE7hUKfaI0Lxm2Ttcm6ZA0bYrP";

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "StormSafe/1.0",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(
        `MTA mirror error: ${response.status} ${response.statusText}`,
        text.slice(0, 300)
      );
      return res.status(response.status).json({
        error: "MTA mirror error",
        status: response.status,
        statusText: response.statusText,
        preview: text.slice(0, 300),
      });
    }

    const data = await response.json();
    console.log('MTA raw entity count:', data?.entity?.length);
    console.log('MTA first entity sample:', JSON.stringify(data?.entity?.[0], null, 2));
    return res.json(data);
  } catch (err) {
    console.error("MTA fetch failed:", err);
    return res.status(500).json({
      error: "Failed to reach MTA alerts feed",
      message: err?.message || String(err),
    });
  }
});

/**
 * GET /api/path/*
 * Proxy to Port Authority (PATH) real-time API — avoids browser CORS restrictions
 */
app.get("/api/path/*", async (req, res) => {
  const suffix = req.params[0]; // e.g. "bin/portauthority/ridepath.json"
  const url = `https://www.panynj.gov/${suffix}`;

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "StormSafe/1.0" },
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: "PATH API error",
        status: response.status,
      });
    }

    const data = await response.json();
    return res.json(data);
  } catch (err) {
    console.error("PATH proxy error:", err);
    return res.status(500).json({
      error: "Failed to reach PATH API",
      message: err?.message || String(err),
    });
  }
});

/**
 * POST /api/claude
 * Secure server-side proxy to Anthropic
 *
 * Requires: ANTHROPIC_API_KEY in .env
 */
app.post("/api/claude", async (req, res) => {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!anthropicKey) {
    return res.status(500).json({
      error: "ANTHROPIC_API_KEY not configured on server",
      hint: "Add ANTHROPIC_API_KEY to .env and restart the server.",
    });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(req.body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        `Anthropic API error: ${response.status} ${response.statusText}`,
        errorBody
      );
      return res.status(response.status).json({
        error: `Anthropic API error: ${response.statusText}`,
        details: errorBody,
      });
    }

    const data = await response.json();
    return res.json(data);
  } catch (err) {
    console.error("Claude proxy error:", err);
    return res.status(500).json({
      error: "Failed to reach Anthropic API",
      message: err?.message || String(err),
    });
  }
});

/**
 * Static files from the built React app (dist/)
 * Used for non-Vercel deployments (Railway, Render, local production preview)
 */
app.use(express.static(path.join(__dirname, "dist")));

/**
 * SPA fallback — any non-API route returns index.html so React Router works
 */
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// Listen only in local dev — Vercel manages the port in production
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n✓ StormSafe server running on http://localhost:${PORT}`);
    console.log("✓ GET  /health");
    console.log("✓ GET  /api/mta-alerts (public)");
    console.log("✓ GET  /api/path/* (PATH proxy)");
    console.log("✓ POST /api/claude\n");
  });
}

export default app;
