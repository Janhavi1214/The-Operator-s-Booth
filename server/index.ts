/**
 * Operator's Booth — x402 Payment-Gated API Server
 *
 * Phase 1: Foundation & Security Rules
 * - 10 KB global JSON body-parser limit (Test 8)
 * - No secrets in source; .env loaded at runtime (Test 4)
 * - Network locked to Base Sepolia eip155:84532 (Test 2)
 * - Pricing & payTo hardcoded server-side (Tests 5, 6)
 *
 * Phase 2: Core Logic & Schema Validation
 * - Zod-validated notice parsing (Test 9)
 * - Fail-safe error handling — never 200 with error body (Test 7)
 */

import dotenv from "dotenv";
dotenv.config();

import express, { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { paymentMiddlewareFromConfig, SchemeNetworkServer } from "@x402/express";
import type { FacilitatorClient } from "@x402/core/server";
import { parseNotice, ParseError } from "./parser";

// ──────────────────────────────────────────────────────────────
//  SERVER-SIDE CONSTANTS — never derived from request payloads
// ──────────────────────────────────────────────────────────────

/** The only network this server accepts payments on. */
export const NETWORK = "eip155:84532" as const; // Base Sepolia

/** Wallet address that receives all payments. */
export const PAY_TO = "0x209693Bc6EfC3bEdB5Fc289c4BB405ee73Ca1665" as const;

/** Price for a single-item endpoint (100 wei). */
export const PRICE_SINGLE = "$0.0001" as const;

/** Price for the bulk endpoint (500 wei). */
export const PRICE_BULK = "$0.0005" as const;

/** Exact scheme server implementation for Base Sepolia */
export const exactEvmScheme: SchemeNetworkServer = {
  scheme: "exact",
  defaultAssetTransferMethod: "default",
  paymentFlows: {
    default: {
      supported: ["authorization"],
      default: "authorization",
    },
  },
  async parsePrice(price: any) {
    const priceStr = typeof price === "string" ? price : (price?.amount ?? "100");
    return {
      amount: priceStr,
      asset: "0x0000000000000000000000000000000000000000",
    };
  },
  async enhancePaymentRequirements(requirements: any) {
    return requirements;
  },
};

/** Mock Facilitator Client to handle verification & supported scheme queries offline */
export const mockFacilitatorClient: FacilitatorClient = {
  async verify() {
    return { isValid: true };
  },
  async settle() {
    return { success: true, transaction: "0xmocktx", network: NETWORK };
  },
  async getSupported() {
    return {
      kinds: [
        {
          x402Version: 1,
          scheme: "exact",
          network: NETWORK,
        },
        {
          x402Version: 2,
          scheme: "exact",
          network: NETWORK,
        },
      ],
      extensions: [],
      signers: {},
    };
  },
};

/**
 * x402 route configurations.
 * Each key is "METHOD /path" and the value contains the payment requirements.
 * Pricing, network, and payTo are ALL hardcoded — requests cannot override them.
 */
export const ROUTES_CONFIG = {
  "GET /api/data": {
    accepts: {
      scheme: "exact" as const,
      network: NETWORK,
      payTo: PAY_TO,
      price: PRICE_SINGLE,
      maxTimeoutSeconds: 60,
    },
    description: "Single data item — costs 100 wei on Base Sepolia",
  },
  "POST /api/data/bulk": {
    accepts: {
      scheme: "exact" as const,
      network: NETWORK,
      payTo: PAY_TO,
      price: PRICE_BULK,
      maxTimeoutSeconds: 120,
    },
    description: "Bulk data retrieval — costs 500 wei on Base Sepolia",
  },
  "POST /parse/single": {
    accepts: {
      scheme: "exact" as const,
      network: NETWORK,
      payTo: PAY_TO,
      price: PRICE_SINGLE,
      maxTimeoutSeconds: 60,
    },
    description: "Parse single train notice — costs 100 wei on Base Sepolia",
  },
  "POST /parse/bulk": {
    accepts: {
      scheme: "exact" as const,
      network: NETWORK,
      payTo: PAY_TO,
      price: PRICE_BULK,
      maxTimeoutSeconds: 120,
    },
    description: "Parse bulk train notices — costs 500 wei on Base Sepolia",
  },
};

// ──────────────────────────────────────────────────────────────
//  EXPRESS APP
// ──────────────────────────────────────────────────────────────

export const app = express();

/**
 * Global JSON body parser with a strict 10 KB limit.
 * Any payload exceeding this will be rejected with 413 Payload Too Large.
 */
app.use(express.json({ limit: "10kb" }));

/**
 * x402 Payment Middleware
 * Gates protected endpoints. Requests lacking payment header return 402 Payment Required.
 */
app.use(
  paymentMiddlewareFromConfig(
    ROUTES_CONFIG,
    mockFacilitatorClient,
    [{ network: NETWORK, server: exactEvmScheme }],
    undefined,
    undefined,
    true
  )
);

// ─── Health check (unprotected free route) ────────────────────
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", network: NETWORK });
});

// ─── Data endpoints (legacy/demonstration) ───────────────────
app.get("/api/data", (_req: Request, res: Response) => {
  res.json({
    item: "single-record",
    ts: new Date().toISOString(),
    network: NETWORK,
  });
});

app.post("/api/data/bulk", (req: Request, res: Response) => {
  res.json({
    items: ["record-1", "record-2", "record-3"],
    ts: new Date().toISOString(),
    network: NETWORK,
  });
});

// ─── Parse endpoint (Phase 2 legacy) ─────────────────────────
app.post("/api/parse", (req: Request, res: Response, next: NextFunction) => {
  try {
    const { text } = req.body ?? {};

    if (text === undefined || text === null) {
      res.status(400).json({
        error: "Bad Request",
        message: "Missing required field: text",
      });
      return;
    }

    if (typeof text !== "string") {
      res.status(400).json({
        error: "Bad Request",
        message: "Field 'text' must be a string",
      });
      return;
    }

    const notice = parseNotice(text);
    res.json({ notice });
  } catch (err) {
    next(err);
  }
});

// ─── Paid Endpoint: POST /parse/single (Phase 3) ──────────────
app.post("/parse/single", (req: Request, res: Response, next: NextFunction) => {
  try {
    const { text } = req.body ?? {};

    if (text === undefined || text === null) {
      res.status(400).json({
        error: "Bad Request",
        message: "Missing required field: text",
      });
      return;
    }

    if (typeof text !== "string") {
      res.status(400).json({
        error: "Bad Request",
        message: "Field 'text' must be a string",
      });
      return;
    }

    const notice = parseNotice(text);
    res.json({ notice });
  } catch (err) {
    next(err);
  }
});

// ─── Paid Endpoint: POST /parse/bulk (Phase 3) ────────────────
app.post("/parse/bulk", (req: Request, res: Response, next: NextFunction) => {
  try {
    const { items, text } = req.body ?? {};

    let rawItems: string[] = [];
    if (Array.isArray(req.body)) {
      rawItems = req.body;
    } else if (Array.isArray(items)) {
      rawItems = items;
    } else if (typeof text === "string") {
      rawItems = [text];
    } else {
      res.status(400).json({
        error: "Bad Request",
        message: "Missing or invalid field: 'items' must be an array of strings or 'text' must be a string",
      });
      return;
    }

    if (rawItems.length === 0) {
      res.status(400).json({
        error: "Bad Request",
        message: "Items array cannot be empty",
      });
      return;
    }

    for (const item of rawItems) {
      if (typeof item !== "string") {
        res.status(400).json({
          error: "Bad Request",
          message: "All items in array must be strings",
        });
        return;
      }
    }

    const notices = rawItems.map((raw) => parseNotice(raw));
    res.json({ notices });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────────────────────
//  GLOBAL ERROR-HANDLING MIDDLEWARE (Test 7)
//  Parse/validation failures → 422 or 400, NEVER 200 with error body
// ──────────────────────────────────────────────────────────────

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  // Zod schema validation failure → 422 Unprocessable Entity
  if (err instanceof ZodError) {
    res.status(422).json({
      error: "Unprocessable Entity",
      message: "Schema validation failed",
      details: err.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
    return;
  }

  // Custom parse extraction failure → 422 Unprocessable Entity
  if (err instanceof ParseError) {
    res.status(422).json({
      error: "Unprocessable Entity",
      message: err.message,
    });
    return;
  }

  // Payload too large error from body-parser → 413 Payload Too Large
  if (
    (err as any).status === 413 ||
    (err as any).type === "entity.too.large" ||
    err.name === "PayloadTooLargeError"
  ) {
    res.status(413).json({
      error: "Payload Too Large",
      message: "Request entity exceeds maximum permitted size of 10kb",
    });
    return;
  }

  // JSON SyntaxError from body-parser → 400 Bad Request
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({
      error: "Bad Request",
      message: "Malformed JSON in request body",
    });
    return;
  }

  // Catch-all — 500 Internal Server Error
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: "Internal Server Error",
    message: "An unexpected error occurred",
  });
});

// ──────────────────────────────────────────────────────────────
//  START SERVER (skipped when imported for testing)
// ──────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? "4020", 10);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🏁 Operator's Booth running on http://localhost:${PORT}`);
    console.log(`   Network : ${NETWORK}`);
    console.log(`   PayTo   : ${PAY_TO}`);
  });
}

export default app;
