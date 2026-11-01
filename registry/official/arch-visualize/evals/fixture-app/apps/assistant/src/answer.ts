import Anthropic from "@anthropic-ai/sdk";
import { ChromaClient } from "chromadb";
import Redis from "ioredis";

const llm = new Anthropic({ timeout: 20000, maxRetries: 2 });
const store = new ChromaClient();
const cache = new Redis(process.env.REDIS_URL);

export async function answer(req, res) {
  const cached = await cache.get(`answer:${req.body.q}`);
  if (cached) return res.json({ answer: cached });
  let context = "";
  try {
    context = JSON.stringify(await store.query({ queryTexts: [req.body.q] }));
  } catch (err) {
    console.warn("vector store unavailable, answering without context");
  }
  const reply = await llm.messages.create({
    model: "claude-sonnet-5-5",
    max_tokens: 400,
    messages: [{ role: "user", content: req.body.q + context }],
  });
  await cache.set(`answer:${req.body.q}`, JSON.stringify(reply), "EX", 300);
  res.json({ answer: reply });
}
