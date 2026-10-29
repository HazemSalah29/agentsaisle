import { PrismaClient } from "@prisma/client";
import { loadSession, saveSession } from "../lib/session";

const prisma = new PrismaClient();

export async function me(req, res) {
  const cached = await loadSession(req.cookies.sid);
  if (cached) return res.json(JSON.parse(cached));
  const user = await prisma.user.findFirst();
  await saveSession(req.cookies.sid, JSON.stringify(user));
  res.json(user);
}
