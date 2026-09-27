/**
 * Phase 2 Core Logic & Schema Validation Tests
 *
 * Test 7 — Fail-safe error handling (returns 422/400, NEVER 200 OK with error message inside)
 * Test 9 — Zod schema validation & notice parsing
 */

import request from "supertest";
import { app } from "../server/index";
import { parseNotice, ParseError, NoticeSchema } from "../server/parser";

describe("Phase 2 — Notice Parser unit tests", () => {
  it("extracts fields from valid notice text", () => {
    const raw = "Train IC 724 at Monaco Monte-Carlo expected at 14:32 due to signal failure.";
    const result = parseNotice(raw);

    expect(result).toEqual({
      train: "IC 724",
      station: "Monaco Monte-Carlo",
      expected_time: "14:32",
      reason: "signal failure",
    });
  });

  it("handles notice text without a reason", () => {
    const raw = "Train RE 3 station Monaco expected at 08:05";
    const result = parseNotice(raw);

    expect(result.train).toBe("RE 3");
    expect(result.station).toBe("Monaco");
    expect(result.expected_time).toBe("08:05");
    expect(result.reason).toBeUndefined();
  });

  it("throws ParseError when required fields are missing", () => {
    expect(() => parseNotice("Hello world random string")).toThrow(ParseError);
  });
});

describe("Phase 2 — API POST /api/parse (Test 7 & Test 9)", () => {
  it("returns 200 OK with validated notice payload for valid input", async () => {
    const res = await request(app)
      .post("/api/parse")
      .send({ text: "Train TGV 9201 at Station Monaco Monte-Carlo expected at 18:45 due to track maintenance." })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("notice");
    expect(NoticeSchema.safeParse(res.body.notice).success).toBe(true);
    expect(res.body.notice.train).toBe("TGV 9201");
  });

  it("returns 422 Unprocessable Entity when text cannot be parsed (Test 7)", async () => {
    const res = await request(app)
      .post("/api/parse")
      .send({ text: "Unparseable garbage text without train info" })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(422);
    expect(res.body.error).toBe("Unprocessable Entity");
    expect(res.body).not.toHaveProperty("notice");
  });

  it("returns 400 Bad Request when text field is missing (Test 7)", async () => {
    const res = await request(app)
      .post("/api/parse")
      .send({})
      .set("Content-Type", "application/json");

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Bad Request");
  });

  it("returns 400 Bad Request when text field is not a string (Test 7)", async () => {
    const res = await request(app)
      .post("/api/parse")
      .send({ text: 12345 })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Bad Request");
  });
});
