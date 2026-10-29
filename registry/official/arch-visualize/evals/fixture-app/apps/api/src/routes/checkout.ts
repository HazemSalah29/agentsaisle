import { PrismaClient } from "@prisma/client";
import { Queue } from "bullmq";

const prisma = new PrismaClient();
const receipts = new Queue("receipts", { connection: { url: process.env.REDIS_URL } });

export async function checkout(req, res) {
  const items = req.body.items as number[];
  const prices = [];
  for (const id of items) {
    prices.push(await prisma.product.findUnique({ where: { id } }));
  }
  const charge = await fetch("https://api.stripe.com/v1/charges", { method: "POST" });
  await receipts.add("send-receipt", { total: prices.length });
  res.json({ ok: charge.ok });
}
