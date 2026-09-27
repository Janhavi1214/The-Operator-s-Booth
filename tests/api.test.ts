/**
 * API Integration Test Suite — tests/api.test.ts
 *
 * Verifies that sending unparseable/garbage input to protected routes
 * fails safely with HTTP 422 or 400 status code, ensuring users are never
 * returned a 200 OK with error messages inside.
 *
 * Payment headers are mocked locally to bypass live blockchain/testnet checks
 * and run instantly in memory.
 */

import request from "supertest";
import fs from "fs";
import path from "path";
import { app } from "../server/index";

describe("API Integration Tests — /parse/single (Mocked Payment)", () => {
  const validNoticeText = fs.readFileSync(
    path.join(__dirname, "..", "data", "valid_notice.txt"),
    "utf-8"
  ).trim();

  const garbageNoticeText = fs.readFileSync(
    path.join(__dirname, "..", "data", "garbage_notice.txt"),
    "utf-8"
  ).trim();

  /**
   * Helper function to construct a mocked x402 payment header that satisfies
   * the server's payment middleware without requiring live testnet funds or chain RPCs.
   */
  async function createMockPaymentHeader(): Promise<string> {
    const challengeRes = await request(app)
      .post("/parse/single")
      .send({ text: "test" });

    expect(challengeRes.status).toBe(402);

    const rawChallenge = challengeRes.headers["x-payment-required"] || challengeRes.headers["payment-required"];
    const challengeObj = JSON.parse(Buffer.from(rawChallenge, "base64").toString("utf-8"));
    const requirement = challengeObj.accepts[0];

    const paymentPayload = {
      x402Version: 2,
      accepted: requirement,
      payload: {
        signature: "0x" + "a".repeat(130),
        authorization: {
          payTo: requirement.payTo,
          amount: requirement.price || "$0.0001",
          network: requirement.network,
        },
      },
    };

    return Buffer.from(JSON.stringify(paymentPayload)).toString("base64");
  }

  it("POST /parse/single with garbage_notice.txt fails safely with HTTP 422 (Unprocessable Entity)", async () => {
    const mockPaymentHeader = await createMockPaymentHeader();

    const res = await request(app)
      .post("/parse/single")
      .set("Content-Type", "application/json")
      .set("payment-signature", mockPaymentHeader)
      .send({ text: garbageNoticeText });

    // MUST return 4xx status (422 Unprocessable Entity), NEVER 200 OK
    expect(res.status).toBe(422);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(res.body).toHaveProperty("error", "Unprocessable Entity");
    expect(res.body).toHaveProperty("message");
    expect(res.body).not.toHaveProperty("notice");
  });

  it("POST /parse/single with valid_notice.txt returns HTTP 200 OK with clean notice JSON", async () => {
    const mockPaymentHeader = await createMockPaymentHeader();

    const res = await request(app)
      .post("/parse/single")
      .set("Content-Type", "application/json")
      .set("payment-signature", mockPaymentHeader)
      .send({ text: validNoticeText });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("notice");
    expect(res.body.notice).toEqual({
      train: "IC 724",
      station: "Monaco Monte-Carlo",
      expected_time: "14:32",
      reason: "signal failure",
    });
  });
});
