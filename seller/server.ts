import express from "express";
import { createGatewayMiddleware } from "@circle-fin/x402-batching/server";
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

const gateway = createGatewayMiddleware({
  sellerAddress: "0x713271395e6e144f409317ee0b58652b942c5c6e",
  facilitatorUrl: "https://gateway-api-testnet.circle.com",
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "Arc AI Query Service" });
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

// Log all 402 responses to help debug payment failures
app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (body: any) => {
    if (res.statusCode === 402 || (body && body.reason)) {
      console.log(`[GATEWAY ERROR] Status: ${res.statusCode}, Body:`, JSON.stringify(body, null, 2));
    }
    return originalJson(body);
  };
  next();
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
  console.log(`Seller address: 0x713271395e6e144f409317ee0b58652b942c5c6e`);
  console.log(`Facilitator: https://gateway-api-testnet.circle.com\n`);
});
