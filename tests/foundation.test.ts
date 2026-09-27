/**
 * Phase 1 Foundation Tests
 *
 * Test 2 — Network is Base Sepolia (eip155:84532)
 * Test 4 — No real secrets in source; .env.example has placeholders only
 * Test 5 — Pricing is hardcoded server-side
 * Test 6 — payTo address is hardcoded server-side
 * Test 8 — 10 KB body-parser limit enforced
 */

import request from "supertest";
import fs from "fs";
import path from "path";
import { app, NETWORK, PAY_TO, PRICE_SINGLE, PRICE_BULK, ROUTES_CONFIG } from "../server/index";

// ─── Test 2: Network Configuration ──────────────────────────

describe("Test 2 — Network locked to Base Sepolia", () => {
  it("exports NETWORK as eip155:84532", () => {
    expect(NETWORK).toBe("eip155:84532");
  });

  it("every route config uses eip155:84532", () => {
    for (const [route, cfg] of Object.entries(ROUTES_CONFIG)) {
      expect(cfg.accepts.network).toBe("eip155:84532");
    }
  });

  it("GET /health returns the correct network", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.network).toBe("eip155:84532");
  });
});

// ─── Test 4: Environment Security ───────────────────────────

describe("Test 4 — No real secrets in source", () => {
  it(".env.example exists and contains only placeholder values", () => {
    const envExamplePath = path.resolve(__dirname, "..", ".env.example");
    const content = fs.readFileSync(envExamplePath, "utf-8");

    // Must contain the placeholder key
    expect(content).toContain("X402_PRIVATE_KEY=your_testnet_key_here");

    // Must NOT contain anything that looks like a real hex private key (64 hex chars)
    const hexKeyPattern = /0x[0-9a-fA-F]{64}/;
    expect(content).not.toMatch(hexKeyPattern);

    // Must NOT contain a mnemonic-like phrase (12+ lowercase words)
    const mnemonicPattern = /([a-z]+\s){11,}[a-z]+/;
    expect(content).not.toMatch(mnemonicPattern);
  });

  it("server/index.ts does not embed private keys or mnemonics", () => {
    const serverPath = path.resolve(__dirname, "..", "server", "index.ts");
    const content = fs.readFileSync(serverPath, "utf-8");

    const hexKeyPattern = /0x[0-9a-fA-F]{64}/;
    expect(content).not.toMatch(hexKeyPattern);

    const mnemonicPattern = /([a-z]+\s){11,}[a-z]+/;
    expect(content).not.toMatch(mnemonicPattern);
  });
});

// ─── Test 5: Fixed Pricing ──────────────────────────────────

describe("Test 5 — Pricing hardcoded server-side", () => {
  it("PRICE_SINGLE is $0.0001", () => {
    expect(PRICE_SINGLE).toBe("$0.0001");
  });

  it("PRICE_BULK is $0.0005", () => {
    expect(PRICE_BULK).toBe("$0.0005");
  });

  it("route config for GET /api/data uses PRICE_SINGLE", () => {
    expect(ROUTES_CONFIG["GET /api/data"].accepts.price).toBe(PRICE_SINGLE);
  });

  it("route config for POST /api/data/bulk uses PRICE_BULK", () => {
    expect(ROUTES_CONFIG["POST /api/data/bulk"].accepts.price).toBe(PRICE_BULK);
  });
});

// ─── Test 6: Fixed payTo Address ────────────────────────────

describe("Test 6 — payTo hardcoded server-side", () => {
  it("PAY_TO is a valid Ethereum address", () => {
    expect(PAY_TO).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it("every route config uses the same PAY_TO constant", () => {
    for (const [_route, cfg] of Object.entries(ROUTES_CONFIG)) {
      expect(cfg.accepts.payTo).toBe(PAY_TO);
    }
  });
});

// ─── Test 8: Payload Size Limit ─────────────────────────────

describe("Test 8 — 10 KB JSON body-parser limit", () => {
  it("accepts a small JSON payload (< 10 KB)", async () => {
    const smallPayload = { data: "x".repeat(100) };
    const res = await request(app)
      .post("/api/data/bulk")
      .send(smallPayload)
      .set("Content-Type", "application/json");

    // Should succeed (not 413)
    expect(res.status).not.toBe(413);
  });

  it("rejects a payload exceeding 10 KB with 413", async () => {
    // Build a payload that is definitively > 10 KB
    const oversizedPayload = { data: "x".repeat(12_000) };
    const res = await request(app)
      .post("/api/data/bulk")
      .send(oversizedPayload)
      .set("Content-Type", "application/json");

    expect(res.status).toBe(413);
  });
});
