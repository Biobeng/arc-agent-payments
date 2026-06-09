import { GatewayClient } from "@circle-fin/x402-batching/client";
import * as dotenv from "dotenv";
dotenv.config();

const privateKey = process.env.PRIVATE_KEY;
if (!privateKey) {
  console.error("ERROR: PRIVATE_KEY not found.");
  process.exit(1);
}
const formattedKey = privateKey.startsWith("0x")
  ? (privateKey as `0x${string}`)
  : (`0x${privateKey}` as `0x${string}`);

const SELLER_BASE_URL = process.env.SELLER_URL || "http://localhost:3000";
const MIN_GATEWAY_BALANCE = 2_000_000n;

class ArcAgent {
  private name: string;
  private callCount = 0;
  private totalSpent = 0n;

  constructor(name: string) {
    this.name = name;
  }

  private createClient(): GatewayClient {
    return new GatewayClient({
      chain: "arcTestnet",
      privateKey: formattedKey,
    });
  }

  log(msg: string) {
    console.log(`[${this.name}] ${msg}`);
  }

  async initialize() {
    this.log("Initializing agent...");
    const client = this.createClient();
    const balances = await client.getBalances();
    this.log(`Wallet USDC: ${balances.wallet.formatted} | Gateway balance: ${balances.gateway.formattedAvailable}`);

    if (balances.gateway.available < MIN_GATEWAY_BALANCE) {
      this.log("Gateway balance low - depositing 1 USDC...");
      const deposit = await client.deposit("1");
      this.log(`Deposit confirmed: ${deposit.depositTxHash}`);
    } else {
      this.log("Gateway balance sufficient. No deposit needed.");
    }
  }

  async queryAI(prompt: string): Promise<string> {
    this.log(`Querying AI: "${prompt}"`);
    const client = this.createClient();

    try {
      const { data, status } = await client.pay(
        `${SELLER_BASE_URL}/ai-query`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
        }
      );

      console.log(`[RESPONSE STATUS] ${status}`);

      if (status !== 200) {
        console.error(`[PAYMENT FAILED] Response:`, JSON.stringify(data, null, 2));
        throw new Error(`Payment failed with status ${status}`);
      }

      this.callCount++;
      this.totalSpent += 1000n;
      this.log(`AI response received (call #${this.callCount})`);
      return (data as any).result;

    } catch (err: any) {
      console.error(`[RAW ERROR]`, err?.message, JSON.stringify(err, null, 2));
      throw new Error(err?.message || "Unknown payment error");
    }
  }

  async fetchMarketData(): Promise<Record<string, unknown>> {
    this.log("Fetching paid market data...");
    const client = this.createClient();

    try {
      const { data, status } = await client.pay(`${SELLER_BASE_URL}/market-data`);

      if (status !== 200) {
        console.error(`[PAYMENT FAILED] Response:`, JSON.stringify(data, null, 2));
        throw new Error(`Payment failed with status ${status}`);
      }

      this.callCount++;
      this.totalSpent += 100n;
      this.log(`Market data received (call #${this.callCount})`);
      return (data as any).data;

    } catch (err: any) {
      console.error(`[RAW ERROR]`, err?.message, JSON.stringify(err, null, 2));
      throw new Error(err?.message || "Unknown payment error");
    }
  }

  async printSummary() {
    const client = this.createClient();
    const balances = await client.getBalances();
    console.log(`\nAgent Summary: ${this.name}`);
    console.log(`Total API calls made : ${this.callCount}`);
    console.log(`Total USDC spent     : $${(Number(this.totalSpent) / 1_000_000).toFixed(6)}`);
    console.log(`Gateway balance left : ${balances.gateway.formattedAvailable} USDC`);
    console.log(`Wallet USDC          : ${balances.wallet.formatted}\n`);
  }
}

async function runAgent() {
  console.log("\nArc Agent-to-Service Payment Demo");
  console.log("Powered by Circle Gateway Nanopayments on Arc Testnet\n");

  const agent = new ArcAgent("ArcAgent-01");
  await agent.initialize();

  const queries = [
    "What are the benefits of agent-to-agent payments on Arc?",
    "Tell me about DeFi opportunities on Arc",
    "What is the current price of USDC?",
  ];

  for (const query of queries) {
    const result = await agent.queryAI(query);
    console.log(`   Response: ${result}\n`);
    await new Promise((r) => setTimeout(r, 3000));
  }

  const marketData = await agent.fetchMarketData();
  console.log("   Market Data:", JSON.stringify(marketData, null, 2), "\n");

  await agent.printSummary();
}

runAgent().catch((err) => {
  console.error("Agent error:", err.message);
  process.exit(1);
});
