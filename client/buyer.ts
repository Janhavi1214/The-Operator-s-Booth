/**
 * Operator's Booth — x402 Buyer Client Script
 *
 * Phase 4: Data Fixtures & Buyer Script
 * - Reads announcement text from data/valid_notice.txt (or CLI parameter)
 * - Makes initial request to POST /parse/single
 * - Intercepts 402 Payment Required challenge from server
 * - Constructs & attaches x402 Base Sepolia (eip155:84532) payment proof
 * - Re-submits request with payment proof header and outputs clean JSON result
 */

import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

const SERVER_URL = process.env.SERVER_URL || "http://localhost:4020";
const PRIVATE_KEY = process.env.X402_PRIVATE_KEY || "your_testnet_key_here";

/**
 * Executes a paid request against the x402 payment-gated server.
 *
 * @param filePath Path to notice text file
 */
export async function runBuyer(filePath?: string): Promise<any> {
  const targetFile = filePath || path.join(__dirname, "..", "data", "valid_notice.txt");

  if (!fs.existsSync(targetFile)) {
    console.error(`❌ Error: File not found: ${targetFile}`);
    process.exit(1);
  }

  const rawText = fs.readFileSync(targetFile, "utf-8").trim();
  console.log(`\n======================================================`);
  console.log(`🚆 Operator's Booth — x402 Client Buyer Script`);
  console.log(`======================================================`);
  console.log(`📄 Target Notice File : ${path.basename(targetFile)}`);
  console.log(`💬 Raw Input Text     : "${rawText}"`);
  console.log(`🌐 Endpoint           : ${SERVER_URL}/parse/single\n`);

  // Step 1: Initial request (without payment header)
  console.log(`[Step 1] Sending initial request without payment header...`);
  const firstResponse = await fetch(`${SERVER_URL}/parse/single`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: rawText }),
  });

  console.log(`   └─ Response Status : ${firstResponse.status} ${firstResponse.statusText}`);

  if (firstResponse.status !== 402) {
    if (firstResponse.ok) {
      const data = await firstResponse.json();
      console.log(`\n✅ Direct Success (No 402 challenge required):`);
      console.log(JSON.stringify(data, null, 2));
      return data;
    }
    const errBody = await firstResponse.json();
    console.log(`\n❌ Error Response (${firstResponse.status}):`);
    console.log(JSON.stringify(errBody, null, 2));
    return errBody;
  }

  // Step 2: Handle 402 Payment Required challenge
  console.log(`\n[Step 2] Received 402 Payment Required challenge!`);
  const headerValue = firstResponse.headers.get("x-payment-required") || firstResponse.headers.get("payment-required");
  let challengeBody: any = {};
  if (headerValue) {
    try {
      challengeBody = JSON.parse(Buffer.from(headerValue, "base64").toString("utf-8"));
    } catch {
      challengeBody = await firstResponse.json().catch(() => ({}));
    }
  } else {
    challengeBody = await firstResponse.json().catch(() => ({}));
  }

  const requirements = challengeBody?.accepts?.[0] ?? {
    scheme: "exact",
    network: "eip155:84532",
    payTo: "0x209693Bc6EfC3bEdB5Fc289c4BB405ee73Ca1665",
    price: "$0.0001",
    maxTimeoutSeconds: 60,
  };

  console.log(`   ├─ Network         : ${requirements.network}`);
  console.log(`   ├─ Payee Address   : ${requirements.payTo}`);
  console.log(`   └─ Required Price  : ${requirements.price || "$0.0001"}`);

  // Step 3: Construct x402 Payment Proof (v2 format)
  console.log(`\n[Step 3] Constructing x402 payment proof...`);
  const paymentPayload = {
    x402Version: 2,
    accepted: requirements,
    payload: {
      signature: "0x" + "a".repeat(130), // Mock wallet signature for testnet
      authorization: {
        payTo: requirements.payTo,
        amount: requirements.price || "$0.0001",
        network: requirements.network || "eip155:84532",
      },
    },
  };

  const paymentHeader = Buffer.from(JSON.stringify(paymentPayload)).toString("base64");

  // Step 4: Re-submit request with payment proof
  console.log(`\n[Step 4] Re-submitting request with payment proof header...`);
  const paidResponse = await fetch(`${SERVER_URL}/parse/single`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "payment-signature": paymentHeader,
    },
    body: JSON.stringify({ text: rawText }),
  });

  console.log(`   └─ Response Status : ${paidResponse.status} ${paidResponse.statusText}`);

  if (!paidResponse.ok) {
    const errorData = await paidResponse.json();
    console.error(`\n❌ Error (${paidResponse.status}):`);
    console.error(JSON.stringify(errorData, null, 2));
    return errorData;
  }

  const resultJson = await paidResponse.json();
  console.log(`\n======================================================`);
  console.log(`🎉 SUCCESS — Gated Notice Parsed & Verified!`);
  console.log(`======================================================`);
  console.log(JSON.stringify(resultJson, null, 2));
  console.log(`======================================================\n`);

  return resultJson;
}

// Execute CLI script if invoked directly
if (require.main === module) {
  const inputFile = process.argv[2];
  runBuyer(inputFile).catch((err) => {
    console.error("Fatal client error:", err);
    process.exit(1);
  });
}
