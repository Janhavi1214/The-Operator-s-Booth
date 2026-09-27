# 🏁 Operator's Booth — x402 Payment-Gated API Server

An **x402 Payment-Gated API Server** built with Node.js, Express, TypeScript, Zod, and `@x402/express`. It provides real-time railway announcement notice parsing gated by micro-payments on the **Base Sepolia (eip155:84532)** testnet.

---

## 🌟 Features & Architecture

- 🛡️ **Environment Security**: No secret keys or mnemonics in source code. `.env.example` contains placeholders only.
- ⚡ **Fixed Server-Side Pricing & Network Lock**:
  - Network locked strictly to **Base Sepolia (`eip155:84532`)**.
  - PayTo wallet address hardcoded on server (`0x209693Bc6EfC3bEdB5Fc289c4BB405ee73Ca1665`).
  - Single item parsing: `$0.0001` (100 wei).
  - Bulk items parsing: `$0.0005` (500 wei).
- 🔒 **Input Size Limits**: Global JSON body-parser capped at **10 KB**. Oversized payloads return `413 Payload Too Large`.
- 🧩 **Zod Notice Parser**: Parses free-text railway announcements into validated `{ train, station, expected_time, reason? }` JSON objects.
- 🚫 **Fail-Safe Error Handling**: Validation failures return `HTTP 422 Unprocessable Entity` or `HTTP 400 Bad Request`. **Never returns `200 OK` with an error message inside.**

---

## 🛣️ API Routes

| Endpoint | Method | Payment Required? | Price | Description |
| :--- | :---: | :---: | :---: | :--- |
| `/health` | `GET` | ❌ Free | `$0.00` | Unprotected server health status |
| `/parse/single` | `POST` | ✅ Gated | `$0.0001` | Parses a single free-text notice into structured JSON |
| `/parse/bulk` | `POST` | ✅ Gated | `$0.0005` | Parses an array of free-text notices into structured JSON |

---

## 🚀 Setup & Installation

### 1. Prerequisites
- **Node.js** v18+ 
- **npm** v9+

### 2. Clone & Install Dependencies
```bash
git clone https://github.com/Janhavi1214/F1_monaco_2025.git
cd "Operator's Booth"
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Default `.env` contents:
```env
PORT=4020
X402_PRIVATE_KEY=your_testnet_key_here
```

---

## 💻 How to Run

Follow these instructions to run the application end-to-end using two terminal windows:

### Terminal 1: Start the API Server
Start the Express server on port 4020:
```bash
npm run dev
```
*Expected Server Output:*
```
🚀 Server listening on http://localhost:4020
⛓️  Network: eip155:84532 (Base Sepolia)
💰 PayTo: 0x209693Bc6EfC3bEdB5Fc289c4BB405ee73Ca1665
```

### Terminal 2: Execute the Buyer Client Script
In a second terminal window, run the client buyer script to execute the 402 payment challenge-response flow:

#### 1. Test Valid Notice:
```bash
npm run buyer
```
*or specify the valid notice file explicitly:*
```bash
npm run buyer data/valid_notice.txt
```

#### 2. Test Garbage / Malformed Notice (Rejection Logic):
```bash
npm run buyer data/garbage_notice.txt
```

#### What the Buyer Script Does:
1. Reads raw notice text from `data/valid_notice.txt` or `data/garbage_notice.txt`.
2. Sends an initial request to `POST http://localhost:4020/parse/single`.
3. Intercepts the `402 Payment Required` challenge header (`x-payment-required`) from the server.
4. Constructs an x402 payment proof matching the Base Sepolia network requirements.
5. Re-submits the request with the payment proof header attached.
6. Displays either the validated notice JSON (`200 OK`) or error output (`422 Unprocessable Entity`).

---

## 🧪 Running Automated Tests

Run the full Jest integration test suite covering all 5 phases:

```bash
npm test
```

### Test Suite Overview:
- `tests/foundation.test.ts`: Network lock (`eip155:84532`), environment security, hardcoded pricing, payTo address, and 10 KB payload limit.
- `tests/phase2.test.ts`: Zod schema validation and regex notice parsing logic.
- `tests/phase3.test.ts`: Route gating and 402 Payment Required challenge responses.
- `tests/phase4.test.ts`: End-to-end buyer client challenge-response payment workflow.
- `tests/api.test.ts`: API integration tests for garbage input handling with mocked payment headers (ensuring HTTP 422, never 200 OK).

---

## 📁 Repository Structure

```
Operator's Booth/
├── server/
│   ├── index.ts              # Express server & x402 payment middleware gating
│   ├── parser.ts             # Zod schema notice parser
│   └── x402-express.d.ts     # Type declarations for @x402 modules
├── client/
│   └── buyer.ts              # Client buyer script (x402 402 challenge handling)
├── data/
│   ├── valid_notice.txt      # Mock railway announcement text
│   └── garbage_notice.txt    # Unparseable gibberish notice text
├── tests/
│   ├── foundation.test.ts    # Phase 1 tests (network, security, pricing)
│   ├── phase2.test.ts        # Phase 2 tests (parser & validation)
│   ├── phase3.test.ts        # Phase 3 tests (routing & x402 gating)
│   ├── phase4.test.ts        # Phase 4 tests (buyer script e2e)
│   └── api.test.ts           # Phase 5 API integration test with mocked payments
├── .env.example              # Environment variable template with placeholders only
├── package.json              # Dependencies and npm scripts
├── tsconfig.json             # TypeScript compiler configuration
└── README.md                 # Project documentation
```

---

## 📄 License
ISC
