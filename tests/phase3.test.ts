/**
 * Phase 3 — Routing & x402 Payment Gating Tests
 *
 * Test 1 — Protective gating returns 402 Payment Required when payment header is missing
 */

import request from "supertest";
import { app } from "../server/index";

describe("Phase 3 — Free Endpoint", () => {
  it("GET /health returns 200 OK without requiring payment", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "ok");
    expect(res.body).toHaveProperty("network", "eip155:84532");
  });
});

describe("Phase 3 — Protected Endpoints (Test 1: Payment Gating)", () => {
  it("POST /parse/single returns 402 Payment Required when no payment header is provided", async () => {
    const res = await request(app)
      .post("/parse/single")
      .send({ text: "Train IC 724 at Monaco Monte-Carlo expected at 14:32" })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(402);
  });

  it("POST /parse/bulk returns 402 Payment Required when no payment header is provided", async () => {
    const res = await request(app)
      .post("/parse/bulk")
      .send({ items: ["Train IC 724 at Monaco Monte-Carlo expected at 14:32"] })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(402);
  });

  it("GET /api/data returns 402 Payment Required when no payment header is provided", async () => {
    const res = await request(app).get("/api/data");
    expect(res.status).toBe(402);
  });

  it("POST /api/data/bulk returns 402 Payment Required when no payment header is provided", async () => {
    const res = await request(app)
      .post("/api/data/bulk")
      .send({ items: ["1"] });

    expect(res.status).toBe(402);
  });
});
