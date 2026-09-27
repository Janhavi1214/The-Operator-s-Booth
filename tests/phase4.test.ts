/**
 * Phase 4 — Data Fixtures & Buyer Script Tests
 *
 * Test 3 — End-to-end client payment flow with data fixtures
 */

import http from "http";
import path from "path";
import { app } from "../server/index";
import { runBuyer } from "../client/buyer";

describe("Phase 4 — End-to-end Buyer Script (Test 3)", () => {
  let server: http.Server;

  beforeAll((done) => {
    server = app.listen(4020, () => {
      done();
    });
  });

  afterAll((done) => {
    server.close(() => {
      done();
    });
  });

  it("buyer script reads valid_notice.txt, handles 402 challenge, submits proof, and gets parsed notice", async () => {
    const validFile = path.join(__dirname, "..", "data", "valid_notice.txt");
    const result = await runBuyer(validFile);

    expect(result).toHaveProperty("notice");
    expect(result.notice).toEqual({
      train: "IC 724",
      station: "Monaco Monte-Carlo",
      expected_time: "14:32",
      reason: "signal failure",
    });
  });

  it("buyer script reads garbage_notice.txt, handles 402, and returns 422 Unprocessable Entity", async () => {
    const garbageFile = path.join(__dirname, "..", "data", "garbage_notice.txt");
    const result = await runBuyer(garbageFile);

    expect(result).toHaveProperty("error", "Unprocessable Entity");
    expect(result).not.toHaveProperty("notice");
  });
});
