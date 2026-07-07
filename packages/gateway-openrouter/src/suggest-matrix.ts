import { createOpenRouterGateway } from "./gateway.js";

async function main() {
  const gateway = createOpenRouterGateway();
  const catalog = await gateway.catalog();

  console.log("Suggested starting matrix (from live catalog):");
  console.log(
    "  Embedding:",
    catalog.embedding.slice(0, 3).map((m) => m.id).join(", ")
  );
  console.log(
    "  Rerank:",
    catalog.rerank.slice(0, 2).map((m) => m.id).join(", "),
    "+ none"
  );
  const chat = [
    catalog.chat.find((m) => /mini|haiku|flash/i.test(m.id)),
    catalog.chat.find((m) => /sonnet|gpt-4o|4\.1/i.test(m.id)),
    catalog.chat.find((m) => /opus|o1|o3|pro/i.test(m.id)),
  ].filter(Boolean);
  console.log("  Chat:", chat.map((m) => m!.id).join(", "));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
