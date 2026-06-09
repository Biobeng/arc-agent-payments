import express from "express";
import { createGatewayMiddleware, BatchFacilitatorClient } from "@circle-fin/x402-batching/server";
import { formatUnits } from "viem";

type PaidRequest = express.Request & {
  payment?: {
    verified: boolean;
    payer: string;
    amount: string;
    network: string;
    transaction?: string;
  };
};

const app = express();
app.use(express.json());

const SELLER_ADDRESS = "0x713271395e6e144f409317ee0b58652b942c5c6e";
const FACILITATOR_URL = "https://gateway-api-testnet.circle.com";

// Direct facilitator client for raw settle debugging
const facilitator = new BatchFacilitatorClient({ url: FACILITATOR_URL });

const gateway = createGatewayMiddleware({
  sellerAddress: SELLER_ADDRESS,
  facilitatorUrl: FACILITATOR_URL,
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "Arc AI Query Service" });
});

// Debug endpoint - bypasses middleware and calls settle() directly to expose raw errorReason
app.post("/debug-pay", async (req, res) => {
  const paymentHeader = req.headers["x-payment"] || req.headers["payment-signature"] || req.headers["authorization"];

  if (!paymentHeader) {
    return res.status(402).json({
      error: "No payment header found",
      hint: "Send request with Payment-Signature or x-payment header"
    });
  }

  console.log("[DEBUG] Raw payment header:", paymentHeader);

  try {
    const settleResponse = await facilitator.settle(paymentHeader as string);
    console.log("[DEBUG] Raw settle response:", JSON.stringify(settleResponse, null, 2));
    return res.json({ settleResponse });
  } catch (err: any) {
    console.error("[DEBUG] Settle error:", JSON.stringify(err, null, 2));
    return res.status(500).json({ error: err.message, raw: err });
  }
});

app.post("/ai-query", gateway.require("$0.001"), (req: PaidRequest, res) => {
  const { payer, amount, network } = req.payment!;
  const { prompt } = req.body;
  const formattedAmount = formatUnits(BigInt(amount), 6);
  console.log(`[PAID] ${formattedAmount} USDC from ${payer} on ${network}`);
  console.log(`[QUERY] ${prompt}`);
  res.json({
    result: generateAIResponse(prompt),
    meta: { paid_by: payer, amount_usdc: formattedAmount, network, timestamp: new Date().toISOString() },
  });
});

app.get("/market-data", gateway.require("$0.0001"), (req: PaidRequest, res) => {
  const { payer, amount, network } = req.payment!;
  const formattedAmount = formatUnits(BigInt(amount), 6);
  console.log(`[PAID] ${formattedAmount} USDC from ${payer} on ${network}`);
  res.json({
    data: {
      arc_usdc_price: 1.0,
      block_height: Math.floor(Math.random() * 1000000) + 500000,
      tps: (Math.random() * 1000 + 500).toFixed(2),
      active_agents: Math.floor(Math.random() * 200) + 50,
    },
    meta: { paid_by: payer, amount_usdc: formattedAmount, network, timestamp: new Date().toISOString() },
  });
});

function generateAIResponse(prompt: string): string {
  const lower = prompt.toLowerCase();
  if (lower.includes("price")) return "Current USDC price on Arc: $1.00.";
  if (lower.includes("agent")) return "Agent-to-service payments on Arc use EIP-3009 offchain signatures.";
  if (lower.includes("defi")) return "Arc DeFi primitives benefit from Circle's financial rails.";
  return `Processing query: "${prompt}". Arc's high-throughput infrastructure makes this response instant.`;
}

app.listen(3000, () => {
  console.log(`\nArc AI Query Service running at http://localhost:3000`);
  console.log(`Seller address: ${SELLER_ADDRESS}`);
  console.log(`Facilitator: ${FACILITATOR_URL}\n`);
  console.log(`Debug endpoint: POST /debug-pay\n`);
});
