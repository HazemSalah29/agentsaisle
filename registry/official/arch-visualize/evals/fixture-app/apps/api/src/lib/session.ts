import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL);

export async function loadSession(id: string) {
  return redis.get(`session:${id}`);
}

export async function saveSession(id: string, data: string) {
  await redis.set(`session:${id}`, data);
}

export async function saveFlash(id: string, data: string) {
  await redis.set(`flash:${id}`, data, "EX", 60);
}
