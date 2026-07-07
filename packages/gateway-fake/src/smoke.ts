import { createFakeGateway } from "./index.js";

const g = createFakeGateway();
const embed = await g.embed({ model: "fake/embed-small", input: ["a", "b"] });
const rerank = await g.rerank({
  model: "fake/rerank-v1",
  query: "api key",
  documents: ["sandbox keys use pk_test_", "unrelated"],
  topN: 1,
});
const chat = await g.chat({
  model: "fake/chat-mini",
  messages: [{ role: "user", content: "hello" }],
});
console.log({ embed: embed.receipt, rerank: rerank.receipt, chat: chat.receipt });
