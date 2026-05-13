# Arc Agent-to-Service Payments

An AI agent that autonomously pays for API calls using Circle Gateway Nanopayments on Arc Testnet.

Built with the x402 protocol — agents fund once, sign offchain payment authorizations per call, and Gateway settles in batches onchain.

---

## What this builds

**Seller service** — an Express API with two paid endpoints:
- `POST /ai-query` — costs $0.001 USDC per call
- `GET /market-data` — costs $0.0001 USDC per call

**Buyer agent** — a TypeScript agent that:
1. Checks its Gateway balance and auto-deposits USDC if needed
2. Detects 402 responses and signs EIP-3009 payment authorizations offchain
3. Retries the request with payment attached
4. Consumes multiple services autonomously and prints a cost summary

---

## Prerequisites

- Node.js v18 or later
- An EVM wallet private key
- Testnet USDC from https://faucet.circle.com (select Arc Testnet)
- Testnet ETH for the one-time Gateway deposit transaction

---

## Setup

### 1. Start the seller service

```bash
cd seller
cp tsconfig.json ../tsconfig.json  # or copy from root
npm install

# Set your wallet address to receive payments
export SELLER_ADDRESS=0xYOUR_SELLER_WALLET_ADDRESS

npm start
```

The server runs at http://localhost:3000

### 2. Run the buyer agent

In a new terminal:

```bash
cd buyer
npm install

# Create .env file with your private key
echo "PRIVATE_KEY=0xYOUR_PRIVATE_KEY" > .env

npm run run-agent
```

---

## How it works

```
Agent                          Seller API                    Circle Gateway
  |                                |                               |
  |-- POST /ai-query ------------> |                               |
  |                                |-- 402 Payment Required -----> |
  |<-- 402 + payment details ----- |                               |
  |                                |                               |
  |-- sign EIP-3009 offchain ----> (zero gas, no chain interaction)|
  |                                |                               |
  |-- POST /ai-query + signature-> |                               |
  |                                |-- verify + serve response     |
  |<-- 200 + AI response --------- |                               |
  |                                |                               |
  |                          (batched later) -- settle onchain --> |
```

Key points:
- The agent only needs gas for the one-time USDC deposit into Gateway
- Every subsequent payment is a free offchain signature
- Gateway batches hundreds of payments into a single onchain settlement
- Sub-cent payments become economically viable for the first time

---

## Extending this

**Swap the simulated AI response** in `seller/server.ts` with a real LLM call:

```typescript
import Anthropic from "@anthropic-ai/sdk";
const anthropic = new Anthropic();

const message = await anthropic.messages.create({
  model: "claude-opus-4-20250514",
  max_tokens: 256,
  messages: [{ role: "user", content: prompt }],
});
```

**Add more paid endpoints** by chaining `gateway.require()` with any price:

```typescript
app.get("/premium-report", gateway.require("$0.05"), handler);
app.post("/image-analysis", gateway.require("$0.002"), handler);
```

**Run multiple agents** by creating more `ArcAgent` instances with different private keys — each maintains its own Gateway balance and pays independently.

---

## Supported networks

Arc Testnet chain ID: `eip155:5042002`

Full list: https://developers.circle.com/gateway/references/supported-blockchains
