import express from "express";
import { createGatewayMiddleware } from "@circle-fin/x402-batching/server";
import { formatUnits } from "viem";
import * as dotenv from "dotenv";
dotenv.config();

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

const SELLER_ADDRESS = process.env.SELLER_ADDRESS;
if (!SELLER_ADDRESS) {
  console.error("ERROR: SELLER_ADDRESS is not set in your .env file. Exiting.");
  process.exit(1);
}

const FACILITATOR_URL = "https://gateway-api-testnet.circle.com";

const gateway = createGatewayMiddleware({
  sellerAddress: SELLER_ADDRESS,
  facilitatorUrl: FACILITATOR_URL,
  onAfterVerify: (ctx: any) => {
    console.log("[onAfterVerify]", JSON.stringify(ctx.result, null, 2));
  },
  onVerifyFailure: (ctx: any) => {
    console.error("[onVerifyFailure]", JSON.stringify(ctx.error, null, 2));
  },
  onAfterSettle: (ctx: any) => {
    console.log("[onAfterSettle]", JSON.stringify(ctx.result, null, 2));
  },
  onSettleFailure: (ctx: any) => {
    console.error("[onSettleFailure]", JSON.stringify(ctx.error, null, 2));
  },
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
    meta: {
      paid_by: payer,
      amount_usdc: formattedAmount,
      network,
      timestamp: new Date().toISOString(),
    },
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
    meta: {
      paid_by: payer,
      amount_usdc: formattedAmount,
      network,
      timestamp: new Date().toISOString(),
    },
  });
});

function generateAIResponse(prompt: string): string {
  const lower = (prompt || "").toLowerCase();
  if (lower.includes("price")) return "Current USDC price on Arc: $1.00.";
  if (lower.includes("agent")) return "Agent-to-service payments on Arc use EIP-3009 offchain signatures.";
  if (lower.includes("defi")) return "Arc DeFi primitives benefit from Circle's financial rails.";
  return `Processing query: "${prompt}". Arc's high-throughput infrastructure makes this response instant.`;
}

app.listen(3000, () => {
  console.log(`\nArc AI Query Service running at http://localhost:3000`);
  console.log(`Seller address: ${SELLER_ADDRESS}`);
  console.log(`Facilitator: ${FACILITATOR_URL}\n`);
});
