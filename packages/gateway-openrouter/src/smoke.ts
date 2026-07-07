import { createOpenRouterGateway } from "./gateway.js";

async function main() {
  const gateway = createOpenRouterGateway();

  console.log("=== Embed ===");
  const embed = await gateway.embed({
    model: process.env.SMOKE_EMBED_MODEL ?? "openai/text-embedding-3-small",
    input: ["RAGtime smoke one", "RAGtime smoke two"],
  });
  console.log("dims:", embed.dims);
  console.log("receipt:", embed.receipt);

  console.log("\n=== Rerank ===");
  const rerankModel = process.env.SMOKE_RERANK_MODEL;
  if (rerankModel) {
    const rerank = await gateway.rerank({
      model: rerankModel,
      query: "message delivery API",
      documents: ["Pigeon sends email", "Unrelated recipe", "Webhook retries"],
      topN: 2,
    });
    console.log("results:", rerank.results);
    console.log("receipt:", rerank.receipt);
  } else {
    console.log("(skipped: set SMOKE_RERANK_MODEL)");
  }

  console.log("\n=== Chat ===");
  const chat = await gateway.chat({
    model: process.env.SMOKE_CHAT_MODEL ?? "openai/gpt-4o-mini",
    messages: [{ role: "user", content: "Reply with exactly: smoke ok" }],
  });
  console.log("text:", chat.text.slice(0, 80));
  console.log("receipt:", chat.receipt);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
